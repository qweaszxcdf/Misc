const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const source=fs.readFileSync(require('node:path').join(__dirname,'../scripts/spotify-proto.js'),'utf8');
const v=n=>{const a=[];do{let x=n%128;n=Math.floor(n/128);a.push(n?x|128:x);}while(n);return Buffer.from(a);};
const cat=(...x)=>Buffer.concat(x.map(Buffer.from));
const field=(id,p)=>cat(v(id*8+2),v(p.length),p),str=(id,s)=>field(id,Buffer.from(s));
const entry=(k,v)=>field(1,cat(str(1,k),field(2,v)));
const data=()=>cat(entry('ads',cat(v(16),v(1))),entry('catalogue',str(4,'free')),entry('other',str(4,'unmodified')));
const fixture=t=>{const u=field(1,field(3,data()));return t==='bootstrap'?field(2,field(1,field(1,u))):u;};
function run(t='bootstrap',body=fixture(t),method='POST',status=200){
 const calls=[];const context={$request:{url:'https://spclient.wg.spotify.com/'+(t==='bootstrap'?'bootstrap/v1/bootstrap':'user-customization-service/v1/customize'),method},$response:{status,body:Uint8Array.from(body)},$done:x=>calls.push(x),console:{log(){}},Uint8Array};vm.runInNewContext(source,context);assert.equal(calls.length,1);return calls[0];
}
for(const t of ['bootstrap','customize'])test(t+' default premium mutation retains unknown bytes',()=>{const res=run(t);assert.ok(res.body);assert.ok(Buffer.from(res.body).includes(Buffer.from('premium')));assert.ok(Buffer.from(res.body).includes(Buffer.from('unmodified')));});
test('schema drift passes through',()=>assert.deepEqual(Object.keys(run('bootstrap',field(99,Buffer.from('noise')))),[]));
test('invalid wire passes through',()=>assert.deepEqual(Object.keys(run('bootstrap',Buffer.from([0xff,0xff,0xff,0xff,0xff]))),[]));
test('non-POST passes through',()=>assert.deepEqual(Object.keys(run('customize',fixture('customize'),'GET')),[]));
test('non-200 passes through',()=>assert.deepEqual(Object.keys(run('customize',fixture('customize'),'POST',401)),[]));
