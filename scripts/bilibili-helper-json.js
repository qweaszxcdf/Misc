'use strict';
// Bilibili JSON splash/search/feed filter: no network or storage access.
(function(){
  try{
    const url=($request&&$request.url||'').split('?')[0];
    if(!/^https:\/\/app\.bilibili\.com\/x\/v2\/(?:splash\/(?:list|event\/list2|brand\/list)|search|feed\/index)$/.test(url))return $done({});
    const status=String($response&&($response.status||$response.statusCode)||'');
    const body=$response&&$response.body;
    if(!/(?:^|\s)200(?:\s|$)/.test(status)||typeof body!=='string'||!body.length||body.length>2097152)return $done({});
    const payload=JSON.parse(body);
    if(!obj(payload)||payload.code!==0||!obj(payload.data))return $done({});
    const data=payload.data;
    let changed=false;
    const clear=(holder,key)=>{
      if(obj(holder)&&Array.isArray(holder[key])&&holder[key].length){
        holder[key]=[];changed=true;
      }
    };
    const filter=(holder,key,pred)=>{
      if(!obj(holder)||!Array.isArray(holder[key]))return;
      const prev=holder[key],next=prev.filter(x=>!pred(x));
      if(next.length!==prev.length){holder[key]=next;changed=true;}
    };
    if(url.includes('/splash/brand/list')){
      // Preserve legitimate branded launch artwork; remove only explicitly marked ads.
      for(const holder of [data,obj(data.list)?data.list:null])
        for(const key of ['list','show'])
          filter(holder,key,x=>obj(x)&&(x.is_ad===true||x.is_ad===1||x.isAd===true||x.type==='ad'));
    }else if(url.includes('/splash/')){
      for(const key of ['list','show','preload','event_list'])clear(data,key);
      if(obj(data.list))for(const key of ['list','show'])clear(data.list,key);
      if(typeof data.max_time==='number'&&Number.isFinite(data.max_time)&&data.max_time!==0){
        data.max_time=0;changed=true;
      }
    }else if(url.endsWith('/search')){
      filter(data,'item',x=>obj(x)&&(typeof x.linktype==='string'&&x.linktype.endsWith('_ad')||x.is_ad===1||x.is_ad===true));
    }else if(url.endsWith('/feed/index')){
      filter(data,'items',x=>obj(x)&&typeof x.card_type==='string'&&/(?:banner|(^|_)cm($|_))/i.test(x.card_type));
    }
    return $done(changed?{body:JSON.stringify(payload)}:{});
  }catch(e){console.log('Bilibili JSON passthrough: '+String(e).slice(0,120));return $done({});}
})();
function obj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
