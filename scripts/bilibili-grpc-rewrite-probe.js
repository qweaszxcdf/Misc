'use strict';
// Bilibili gRPC response rewrite probe.
// identity: return the same bytes as a newly allocated Uint8Array.
// retag: preserve payload length, replacing selected protobuf field numbers
// with currently unrecognized wire-compatible numbers. EXPERIMENT ONLY.
// No network, storage, or logging of response contents.
(function(){
  try {
    const url=($request && $request.url || '').split('?')[0];
    const mode=(typeof $argument==='string' ? $argument.match(/(?:^|;)mode=([A-Za-z]+)/) : null);
    const operation=mode?mode[1]:'identity';
    const body=$response && $response.body;
    const status=String($response && ($response.status||$response.statusCode)||'');
    if(!/(?:^|\s)200(?:\s|$)/.test(status) || !(body instanceof Uint8Array) || body.length<5 || body.length>1048576) return $done({});
    const path=url.replace('https://grpc.biliapi.net/','');
    const detailView=path==='bilibili.app.view.v1.View/View';
    const detailUnite=path==='bilibili.app.viewunite.v1.View/View';
    const comments=path==='bilibili.main.community.reply.v1.Reply/MainList';
    if(!(detailView||detailUnite||comments))return $done({});
    if(operation==='identity')return $done({body:new Uint8Array(body)});
    if(operation!=='retag')return $done({});
    // Do not handle compressed gRPC or multi-message streams.
    if(body[0]!==0)return $done({});
    const expected=body[1]*16777216 + body[2]*65536 + body[3]*256 + body[4];
    if(expected!==body.length-5)return $done({});
    const bytes=new Uint8Array(body);
    const chosen=detailView?{30:190,31:191,41:192}:detailUnite?{7:15}:{11:15};
    const start=5,end=bytes.length,top=scan(bytes,start,end);
    const newIds=new Set(Object.values(chosen));
    // Avoid collisions with existing proto fields.
    if(top.some(f=>newIds.has(f.id)))return $done({});
    let modified=0;
    for(const f of top){
      const id=chosen[f.id];
      if(id===undefined || f.wire!==2)continue;
      const tag=encodeTag(id,2);
      if(tag.length!==f.tagEnd-f.start)return $done({});
      bytes.set(tag,f.start);
      modified++;
    }
    if(modified===0)return $done({});
    // Exactly same response size and gRPC frame length as upstream.
    return $done({body:bytes});
  } catch(e){
    console.log('Bilibili gRPC probe passthrough: '+String(e).slice(0,80));
    return $done({});
  }
})();
function readVarint(b,i,end){
  let n=0,m=1;
  for(let k=0;k<5&&i<end;k++){
    const c=b[i++];n+=(c&127)*m;
    if(n>0xffffffff)throw Error('tag too large');
    if(!(c&128))return [n,i];
    m*=128;
  }
  throw Error('invalid varint');
}
function scan(b,start,end){
  let i=start;const fields=[];
  while(i<end){
    const begin=i,t=readVarint(b,i,end),tag=t[0];
    i=t[1];const tagEnd=i,wire=tag%8,id=Math.floor(tag/8);
    if(!id)throw Error('zero field');
    if(wire===2){const size=readVarint(b,i,end);i=size[1]+size[0];}
    else if(wire===0){let finished=false;for(let j=0;j<10&&i<end;j++){if(!(b[i++]&128)){finished=true;break;}}if(!finished)throw Error('unterminated varint');}
    else if(wire===1)i+=8;
    else if(wire===5)i+=4;
    else throw Error('unsupported protobuf wire');
    if(i>end)throw Error('truncated protobuf');
    fields.push({id,wire,start:begin,tagEnd});
    if(fields.length>25000)throw Error('field count');
  }
  return fields;
}
function encodeTag(id,wire){
  let n=id*8+wire;const out=[];
  do{const v=n%128;n=Math.floor(n/128);out.push(n?v|128:v);}while(n);
  return Uint8Array.from(out);
}
