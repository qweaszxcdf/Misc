'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.resolve(__dirname,'../scripts/bilibili-grpc-sameref.js'),'utf8');
function run(body,status=200){
 const calls=[];
 vm.runInNewContext(script,{$response:{body,status},$done:val=>calls.push(val),Uint8Array,console:{log(){} }});
 assert.equal(calls.length,1);
 return calls[0];
}
test('same Uint8Array reference returned without copy',()=>{
 const source=new Uint8Array([0,1,2,3]);
 const result=run(source);
 assert.strictEqual(result.body,source);
 assert.deepEqual(Array.from(result.body),[0,1,2,3]);
});
test('non-binary or error response passes through',()=>{
 assert.equal(Object.keys(run('not binary')).length,0);
 assert.equal(Object.keys(run(new Uint8Array([1]),503)).length,0);
});
