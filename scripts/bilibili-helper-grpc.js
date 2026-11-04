'use strict';
// Reimplementation of targeted Maasea Bilibili Helper protobuf edits.
// Keep all unknown wire fields. Invalid, compressed, and multi-frame gRPC replies pass through.
(function () {
  try {
    const url=($request && $request.url || '').split('?')[0];
    if (!url.startsWith('https://grpc.biliapi.net/')) return $done({});
    const status=String($response && ($response.status || $response.statusCode) || '');
    const body=$response && $response.body;
    if (!/(?:^|\s)200(?:\s|$)/.test(status) || !(body instanceof Uint8Array) || body.length<5 || body.length>2097152) return $done({});
    if (body[0]!==0) return $done({}); // compressed frames: fail open
    const len=((body[1]*16777216)+(body[2]<<16)+(body[3]<<8)+body[4])>>>0;
    if (len!==body.length-5) return $done({});
    const data=body.subarray(5),is=s=>url.endsWith(s);
    let modified=null;
    if(is('/bilibili.community.service.dm.v1.DM/DmView')) {
      modified=modify(data,f=>nested(f,22,v=>patch(v,x=>x.num===1&&x.wire===2?null:undefined)));
    } else if(is('/bilibili.app.interface.v1.Teenagers/ModeStatus')) {
      modified=modify(data,f=>nested(f,1,teenMode));
    } else if(is('/bilibili.app.view.v1.View/View')) {
      modified=patch(data,f=>[30,31,41].includes(f.num)&&f.wire===2?null:undefined);
    } else if(is('/bilibili.app.view.v1.View/ViewProgress')) {
      modified=patch(data,f=>f.num===1&&f.wire===2?null:undefined);
    } else if(is('/bilibili.main.community.reply.v1.Reply/MainList')) {
      modified=patch(data,f=>f.num===11&&f.wire===2?null:undefined);
    } else if(is('/bilibili.polymer.app.search.v1.Search/SearchAll')) {
      modified=patch(data,f=>{
        if(f.num!==4||f.wire!==2)return;
        const link=stringField(data.subarray(f.valueStart,f.end),4);
        return typeof link==='string'&&link.endsWith('_ad')?null:undefined;
      });
    } else if(is('/bilibili.app.dynamic.v2.Dynamic/DynAll')) {
      modified=modify(data,f=>nested(f,1,dynamicList));
    } else if(is('/bilibili.app.viewunite.v1.View/View')) {
      modified=modify(data,f=>f.num===7&&f.wire===2?null:nested(f,5,tab));
    }
    if(modified===null) return $done({});
    const out=new Uint8Array(modified.length+5),n=modified.length;
    out[0]=0;out[1]=(n>>>24)&255;out[2]=(n>>>16)&255;out[3]=(n>>>8)&255;out[4]=n&255;
    out.set(modified,5);
    return $done({body:out});
  } catch(e) {
    console.log('Bilibili Helper gRPC passthrough: '+String(e).slice(0,120));
    return $done({});
  }
})();
function varint(b,pos,max=5){
  let v=0,m=1;
  for(let i=0;i<max&&pos<b.length;i++){
    const c=b[pos++];v+=(c&127)*m;
    if(v>4294967295)throw Error('varint overflow');
    if(!(c&128))return [v,pos];
    m*=128;
  }
  throw Error('bad varint');
}
function uint(n){const a=[];do{const c=n%128;n=Math.floor(n/128);a.push(n?c|128:c);}while(n);return Uint8Array.from(a);}
function concat(parts){const out=new Uint8Array(parts.reduce((n,x)=>n+x.length,0));let i=0;for(const x of parts){out.set(x,i);i+=x.length;}return out;}
function field(id,body){return concat([uint(id*8+2),uint(body.length),body]);}
function parse(data){
  const out=[];let i=0;
  while(i<data.length){
    const start=i,t=varint(data,i);i=t[1];
    const num=Math.floor(t[0]/8),wire=t[0]%8;
    if(!num)throw Error('field zero');
    let valueStart=i;
    if(wire===2){const l=varint(data,i);i=l[1];valueStart=i;i+=l[0];}
    else if(wire===0){
      let ended=false;
      for(let j=0;j<10&&i<data.length;j++)if(!(data[i++]&128)){ended=true;break;}
      if(!ended)throw Error('invalid scalar varint');
    } else if(wire===1)i+=8;
    else if(wire===5)i+=4;
    else throw Error('unsupported wire type');
    if(i>data.length)throw Error('truncated field');
    out.push({num,wire,start,end:i,valueStart});
    if(out.length>50000)throw Error('field limit');
  }
  return out;
}
function patch(data,selector){
  const ff=parse(data),out=[];let last=0,changed=false;
  for(const f of ff){
    const replacement=selector(f);
    if(replacement===undefined)continue;
    if(replacement!==null&&!(replacement instanceof Uint8Array))throw Error('invalid patch');
    changed=true;out.push(data.subarray(last,f.start));
    if(replacement!==null)out.push(replacement);
    last=f.end;
  }
  if(!changed)return null;
  out.push(data.subarray(last));return concat(out);
}
function modify(data,selector){return patch(data,f=>{f._parent=data;return selector(f);});}
function nested(f,id,transform){
  if(f.num!==id||f.wire!==2)return;
  const edited=transform(f._parent.subarray(f.valueStart,f.end));
  return edited===null?undefined:field(id,edited);
}
function stringField(data,id){
  let result=null;
  for(const f of parse(data))if(f.num===id&&f.wire===2){
    const b=data.subarray(f.valueStart,f.end);
    if(b.length>512||b.some(x=>x>127))return null;
    result=String.fromCharCode(...b);
  }
  return result;
}
function teenMode(mode){
  if(stringField(mode,2)!=='teenagers')return null;
  return modify(mode,f=>nested(f,5,inner=>patch(inner,x=>
    x.num===1&&x.wire===0?concat([uint(8),uint(0)]):undefined)));
}
function dynamicList(data){
  return patch(data,f=>{
    if(f.num!==1||f.wire!==2)return;
    const item=data.subarray(f.valueStart,f.end);
    const t=parse(item).find(x=>x.num===1&&x.wire===0);
    return t&&varint(item,t.valueStart)[0]===15?null:undefined;
  });
}
function tab(data){return modify(data,f=>nested(f,1,tabModule));}
function tabModule(data){return modify(data,f=>nested(f,2,introduction));}
function introduction(data){return modify(data,f=>nested(f,2,commonModule));}
function commonModule(data){
  const t=parse(data).find(f=>f.num===1&&f.wire===0);
  if(!t||varint(data,t.valueStart)[0]!==28)return null;
  return modify(data,f=>nested(f,22,relates));
}
function relates(data){
  return patch(data,f=>{
    if(f.num!==1||f.wire!==2)return;
    const card=data.subarray(f.valueStart,f.end),t=parse(card).find(x=>x.num===1&&x.wire===0);
    return t&&varint(card,t.valueStart)[0]!==1?null:undefined;
  });
}
