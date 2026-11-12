'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const repo=path.join(__dirname,'..'),main=fs.readFileSync(path.join(repo,'spotify-proto-account-parity.sgmodule'),'utf8'),legacy=fs.readFileSync(path.join(repo,'spotify-proto-account-parity-legacy.sgmodule'),'utf8');
const active=main.split(/\r?\n/).filter(x=>x.trim()&&!x.trim().startsWith('#'));
test('upstream 9.1.98 compatible endpoints active',()=>{
 for(const s of ['spotify-proto-new =','spotify-remote =','NoSearchAd =','NoScrollAd ='])assert.ok(active.some(x=>x.startsWith(s)),s);
 assert.ok(active.some(x=>x.includes('remote-config-resolver')&&x.includes('header-del if-none-match')));
 assert.ok(active.some(x=>x.includes('nebula')&&x.includes('header-del if-none-match')));
});
test('upstream experiment toggles match working baseline',()=>{
 assert.ok(!active.some(x=>x.startsWith('spotify-gabo =')));
 assert.ok(!active.some(x=>x.startsWith('NoHomeAd =')));
 assert.ok(!active.some(x=>x.includes('pam-view-service')));
 assert.ok(!active.some(x=>x.includes('spotify-proto-ev3 =')));
 assert.ok(!active.some(x=>x.includes('remoteAds=1')));
});
test('scripts pinned, not moving main refs',()=>{
 for(const l of active.filter(x=>/script-path=/.test(x))){
  assert.ok(l.includes('MY_clash/0e03454fe90b00cecccf8586ba8922c640dc4812/files/lpx/js/'));
  assert.ok(!l.includes('refs/heads/main'));
 }
});
test('legacy backup remains complete',()=>{
 assert.ok(legacy.includes('remoteAds=1'));
 assert.ok(legacy.includes('scripts/spotify-proto-account-parity.js'));
 assert.ok(legacy.includes('NoHomeAd ='));
});
