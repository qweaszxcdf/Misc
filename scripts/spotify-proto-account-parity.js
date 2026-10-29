'use strict';
const ARGUMENTS = Object.create(null);
if (typeof $argument === 'string') {
 for (const item of $argument.split(';')) {
  const eq = item.indexOf('=');
  if (eq > 0) ARGUMENTS[item.slice(0,eq).trim()] = item.slice(eq+1).trim();
 }
}
const SETTINGS={
 simulatePremium: ARGUMENTS.premium !== '0',
 suppressAdFlags: ARGUMENTS.accountAds !== '0',
 modifyRemoteAdFlags: ARGUMENTS.remoteAds === '1'
};
const AD_SWITCHES = Object.freeze({
 'core-ads/music_adt_enabled': false,
 'core-ads/always_keep_preroll_slot_filled': false,
 'core-ads/enable_state_fetch_system': false,
 'core-ads/mark_last_ad_break_time_for_preroll': false,
 'core-ads/enable_ad_request_metrics': false,
 'core-podcast-ads/podcast_adt_enabled': false,
 'core-podcast-ads/fetch_cold_start_preroll_ad': false,
 'core-podcast-ads/send_ad_opportunity_event': false,
 'core-podcast-ads-feature/enable_podcast_inter_episode_cold_start_preroll': false,
 'core-context-track-exts/enable_podcast_sponsored_content': false
});

(function(){
 try {
  if(!$request||!$response||$request.method!=='POST'||Number($response.status)!==200){$done({});return;}
  const url=$request.url||'',bootstrap=/\/bootstrap\/v1\/bootstrap(?:\?.*)?$/.test(url),customize=/\/user-customization-service\/v1\/customize(?:\?.*)?$/.test(url);
  if(!bootstrap&&!customize){$done({});return;}
  const bytes=$response.body;
  if(!(bytes instanceof Uint8Array)||!bytes.length){$done({});return;}
  const desired=Object.create(null);
  const removeKeys=new Set();
  const rawAccountAttributes=Object.create(null);
  modifyAttributes(rawAccountAttributes);
  for(const [key,entry] of Object.entries(rawAccountAttributes)) {
   const adKey=['ads','ab-ad-player-targeting','allow-advertising-id-transmission','restrict-advertising-id-transmission'].includes(key);
   if(adKey ? !SETTINGS.suppressAdFlags : !SETTINGS.simulatePremium)continue;
   const kind=Object.prototype.hasOwnProperty.call(entry,'boolValue')?'bool':'string';
   desired[key]={kind,value:kind==='bool'?entry.boolValue:entry.stringValue};
  }
  if(SETTINGS.simulatePremium || SETTINGS.suppressAdFlags) {
   const upstreamDeletes=["ad-use-adlogic","ad-catalogues","shuffle","payment-state","last-premium-activation-date","on-demand-trial","on-demand-trial-in-progress","smart-shuffle","at-signal","feature-set-id-masked","strider-key","is-eligible-for-trial","is-eligible-for-upsell","upsell-state","ad-session-persistence","ad-formats-preroll-video","is-premium-eligible"];
   for(const key of upstreamDeletes) {
    const adKey=/^(ad-|is-eligible-for-upsell|upsell-state)/.test(key);
    if(adKey ? SETTINGS.suppressAdFlags : SETTINGS.simulatePremium)removeKeys.add(key);
   }
   if(SETTINGS.simulatePremium) for(let k=1;k<=100;k++)removeKeys.add('is-premium-eligible-v'+k);
  }
  if(!Object.keys(desired).length && !removeKeys.size && !SETTINGS.modifyRemoteAdFlags){$done({});return;}
  const account=(Object.keys(desired).length||removeKeys.size) ? patchPath(bytes,bootstrap?[2,1,1,1,3]:[1,3],desired,removeKeys) : bytes;
  if(account===null) return $done({});
  const result=SETTINGS.modifyRemoteAdFlags ? patchConfiguration(account,bootstrap?[2,1,1,1,1,1]:[1,1,1]) : account;
  $done(result===null?{}:{body:result});
 }catch(e){console.log('Spotify Proto passthrough: '+String(e).slice(0,120));$done({});}
})();
function readVarint(b,i,end=b.length){
 let value=0,factor=1;
 for(let j=0;j<5&&i<end;j++){const x=b[i++];value+=(x&127)*factor;if(value>0xffffffff)throw Error('varint overflow');if(!(x&128))return [value,i];factor*=128;}
 throw Error('invalid varint');
}
function skipVarint(b,i){for(let n=0;n<10&&i<b.length;n++){if(!(b[i++]&128))return i;}throw Error('invalid 64bit varint');}
function fields(b){
 let i=0,out=[];
 while(i<b.length){
  const start=i,[tag,afterTag]=readVarint(b,i);i=afterTag;
  const id=Math.floor(tag/8),wire=tag%8;if(!id)throw Error('field zero');
  let ds=i;
  if(wire===2){const [len,p]=readVarint(b,i);ds=p;i=p+len;}
  else if(wire===0)i=skipVarint(b,i);
  else if(wire===1)i+=8;
  else if(wire===5)i+=4;
  else throw Error('unsupported wire');
  if(i>b.length)throw Error('truncated');
  out.push({id,wire,start,end:i,ds});
  if(out.length>100000)throw Error('field limit');
 }
 return out;
}
function vi(n){const a=[];do{let x=n%128;n=Math.floor(n/128);a.push(n?x|128:x);}while(n);return Uint8Array.from(a);}
function cat(parts){const length=parts.reduce((n,p)=>n+p.length,0),b=new Uint8Array(length);let o=0;for(const p of parts){b.set(p,o);o+=p.length;}return b;}
function bytes(s){return Uint8Array.from([...s].map(c=>c.charCodeAt(0)));}
function message(id,payload){return cat([vi(id*8+2),vi(payload.length),payload]);}
function splice(src,fs,replacements,extra=[]){
 const changed=new Map(replacements),parts=[];let last=0;
 for(const f of fs){if(!changed.has(f.start))continue;parts.push(src.subarray(last,f.start));const r=changed.get(f.start);if(r!==null)parts.push(r);last=f.end;}
 parts.push(src.subarray(last),...extra);return cat(parts);
}
function encodeValue(original,desc){
 const f=fields(original),replacements=f.filter(x=>[2,3,4].includes(x.id)).map(x=>[x.start,null]);
 const newField=desc.kind==='bool'?cat([vi(16),vi(desc.value?1:0)]):message(4,bytes(desc.value));
 return splice(original,f,replacements,[newField]);
}
function keyOf(entry){for(const f of fields(entry)){if(f.id===1&&f.wire===2){const b=entry.subarray(f.ds,f.end);if(b.some(x=>x>127))return null;return String.fromCharCode(...b);}}return null;}
function patchEntry(entry,desc){
 const f=fields(entry),values=f.filter(x=>x.id===2&&x.wire===2);
 if(!values.length)return cat([entry,message(2,encodeValue(new Uint8Array(),desc))]);
 return splice(entry,f,values.map(x=>[x.start,message(2,encodeValue(entry.subarray(x.ds,x.end),desc))]));
}
function patchAttributes(src,desired,removeKeys){
 const f=fields(src),seen=new Set(),rep=[];
 for(const x of f){if(x.id!==1||x.wire!==2)continue;const entry=src.subarray(x.ds,x.end),key=keyOf(entry);if(key===null)continue;
  if(removeKeys.has(key)){rep.push([x.start,null]);continue;}
  if(!Object.prototype.hasOwnProperty.call(desired,key))continue;seen.add(key);rep.push([x.start,message(1,patchEntry(entry,desired[key]))]);}
 const extra=Object.keys(desired).filter(x=>!seen.has(x)).map(key=>message(1,cat([message(1,bytes(key)),message(2,encodeValue(new Uint8Array(),desired[key]))])));
 return splice(src,f,rep,extra);
}
function patchPath(src,path,desired,removeKeys){
 if(!path.length)return patchAttributes(src,desired,removeKeys);
 const f=fields(src),replacements=[];
 for(const x of f){if(x.id!==path[0]||x.wire!==2)continue;const patched=patchPath(src.subarray(x.ds,x.end),path.slice(1),desired,removeKeys);if(patched!==null)replacements.push([x.start,message(x.id,patched)]);}
 return replacements.length?splice(src,f,replacements):null;
}

/* Only existing, explicitly named boolean advertising assignments are changed.
   All other remote configuration entries are retained byte-for-byte. */
function asciiField(data,id) {
 const field=fields(data).find(x=>x.id===id&&x.wire===2);
 if(!field) return null;
 const b=data.subarray(field.ds,field.end);
 if(b.some(x=>x>127)) return null;
 return Array.from(b,x=>String.fromCharCode(x)).join('');
}
function patchAssignment(raw) {
 const ff=fields(raw),id=ff.find(x=>x.id===1&&x.wire===2);
 if(!id) return null;
 const p=raw.subarray(id.ds,id.end);
 const scope=asciiField(p,1),name=asciiField(p,2);
 if(!scope||!name) return null;
 const k=scope+'/'+name;
 if(!Object.prototype.hasOwnProperty.call(AD_SWITCHES,k))return null;
 const bool=ff.find(x=>x.id===3&&x.wire===2);
 // Never convert a non-bool configuration; preserve all unknown fields.
 if(!bool)return null;
 const inner=raw.subarray(bool.ds,bool.end),iv=fields(inner);
 const valueField=iv.filter(x=>x.id===1&&x.wire===0);
 const replacement=cat([vi(8),vi(AD_SWITCHES[k]?1:0)]);
 const edited=splice(inner,iv,valueField.map(x=>[x.start,null]),[replacement]);
 return splice(raw,ff,[[bool.start,message(3,edited)]]);
}
function patchConfiguration(bytes,path) {
 if(path.length) {
  const ff=fields(bytes),rep=[];
  for(const x of ff) {
   if(x.id!==path[0]||x.wire!==2)continue;
   const edited=patchConfiguration(bytes.subarray(x.ds,x.end),path.slice(1));
   if(edited!==null)rep.push([x.start,message(x.id,edited)]);
  }
  return rep.length?splice(bytes,ff,rep):bytes;
 }
 const ff=fields(bytes),rep=[];
 for(const x of ff) {
  if(x.id!==3||x.wire!==2)continue;
  const edited=patchAssignment(bytes.subarray(x.ds,x.end));
  if(edited!==null)rep.push([x.start,message(3,edited)]);
 }
 return rep.length?splice(bytes,ff,rep):bytes;
}

function modifyAttributes(attributes) {
  // 1 year from now
  const oneYearFromNow = new Date();
  oneYearFromNow.setUTCFullYear(oneYearFromNow.getUTCFullYear() + 1);

  // ISO8601 UTC string (equivalent to ISO8601DateFormatter + UTC)
  const isoDate = oneYearFromNow.toISOString();

  attributes["ads"] = { boolValue: false };
  attributes["ab-ad-player-targeting"] = { stringValue: "0" };
  attributes["allow-advertising-id-transmission"] = { boolValue: false };
  attributes["restrict-advertising-id-transmission"] = { boolValue: true };
  attributes["can_use_superbird"] = { boolValue: true };
  attributes["catalogue"] = { stringValue: "premium" };
  attributes["financial-product"] = { stringValue: "pr:premium,tc:0" };
  attributes["is-eligible-premium-unboxing"] = { boolValue: true };
  attributes["name"] = { stringValue: "Spotify Premium" };
  attributes["nft-disabled"] = { stringValue: "1" };
  attributes["offline"] = { boolValue: true }; // allow downloading
  attributes["on-demand"] = { boolValue: true };
  attributes["payments-initial-campaign"] = { stringValue: "default" };
  attributes["player-license"] = { stringValue: "premium" };
  attributes["player-license-v2"] = { stringValue: "premium" };
  attributes["product-expiry"] = { stringValue: isoDate };
  attributes["shuffle-eligible"] = { boolValue: true };
  attributes["social-session"] = { boolValue: true };
  attributes["social-session-free-tier"] = { boolValue: false };
  attributes["streaming-rules"] = { stringValue: "" };
  attributes["subscription-enddate"] = { stringValue: isoDate };
  attributes["type"] = { stringValue: "premium" };
  attributes["unrestricted"] = { boolValue: true };


  delete attributes['ad-use-adlogic'];
  delete attributes['ad-catalogues'];

  delete attributes['shuffle']; // 移除 shuffle 属性，由 shuffle-eligible 控制

  delete attributes["payment-state"];
  delete attributes["last-premium-activation-date"];

  // Modern logout prevention
  delete attributes["on-demand-trial"];
  delete attributes["on-demand-trial-in-progress"];
  delete attributes["smart-shuffle"];

  // Additional keys
  delete attributes["at-signal"];
  delete attributes["feature-set-id-masked"];
  delete attributes["strider-key"];
  delete attributes["is-eligible-for-trial"];
  delete attributes["is-eligible-for-upsell"];
  delete attributes["upsell-state"];
  delete attributes["ad-session-persistence"];
  delete attributes["ad-formats-preroll-video"];

  for (let i = 1; i <= 100; i++) {
    delete attributes[`is-premium-eligible-v${i}`];
  }
  delete attributes["is-premium-eligible"];

  
}
