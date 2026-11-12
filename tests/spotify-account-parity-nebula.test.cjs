'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../scripts/spotify-proto-account-parity.js'),'utf8');
const vi=n=>{const a=[];do{const x=n%128;n=Math.floor(n/128);a.push(n?x|128:x);}while(n);return Buffer.from(a);};
const cat=(...a)=>Buffer.concat(a.map(Buffer.from)),field=(id,v)=>cat(vi(id*8+2),vi(v.length),v),sf=(id,s)=>field(id,Buffer.from(s));
const entry=(k,v)=>field(1,cat(sf(1,k),field(2,v)));
const raw=()=>cat(entry('ads',cat(vi(16),vi(1))),entry('catalogue',sf(4,'free')),entry('preserve-me',sf(4,'retained')));
const wrapped=()=>field(1,field(3,raw()));
const bootstrap=()=>field(2,field(1,field(1,wrapped())));
function run(endpoint,method,body,status=200){
 const calls=[],logs=[],env={$request:{url:'https://spclient.wg.spotify.com/'+endpoint,method},$response:{status,body:Uint8Array.from(body)},$argument:'remoteAds=1;debug=1',$done:x=>calls.push(x),console:{log:x=>logs.push(x)},Uint8Array};
 vm.runInNewContext(script,env);assert.equal(calls.length,1);return {result:calls[0],logs};
}
for(const [label,path,method,body] of [
 ['direct nebula','nebula/v1/configuration/attributes','GET',raw()],
 ['wrapped nebula','nebula/v1/configuration/attributes','GET',wrapped()],
 ['bootstrap','bootstrap/v1/bootstrap','POST',bootstrap()],
 ['customize','user-customization-service/v1/customize','POST',wrapped()],
])test(label+' changes premium and retains unknown values',()=>{
 const {result}=run(path,method,body);assert.ok(result.body);
 assert.ok(Buffer.from(result.body).includes(Buffer.from('premium')));
 assert.ok(Buffer.from(result.body).includes(Buffer.from('retained')));
});
test('non-protobuf nebula fails open',()=>assert.deepEqual(Object.keys(run('nebula/v1/configuration/attributes','GET',Buffer.from([255])).result),[]));
test('HTTP method mismatch fails open',()=>assert.deepEqual(Object.keys(run('nebula/v1/configuration/attributes','POST',raw()).result),[]));
test('non-200 status fails open',()=>assert.deepEqual(Object.keys(run('nebula/v1/configuration/attributes','GET',raw(),304).result),[]));
