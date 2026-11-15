import test from 'node:test';
import assert from 'node:assert/strict';
import {createImmersiveMode} from '../src/ui/immersiveMode.ts';
function fixture(options={}){
 let full=false;const calls=[];
 const host={keyboard:{lock:async keys=>{calls.push(['lock',keys]);if(options.denied)throw Error('Permission denied');},unlock:()=>calls.push('unlock')},fullscreen:()=>full,enter:async()=>{calls.push('fullscreen');full=true;},exit:async()=>{calls.push('exit');full=false;},changed:()=>{},...options};
 return {mode:createImmersiveMode(host),host,calls,setFull:value=>{full=value;}};
}
test('explicit immersive entry requests fullscreen before locking only F4; exit releases both',async()=>{
 const f=fixture();assert.equal(f.mode.phase,'off');assert.deepEqual(f.calls,[]);
 await f.mode.enter();assert.equal(f.mode.phase,'active');assert.deepEqual(f.calls,['fullscreen',['lock',['F4']]]);
 await f.mode.leave();assert.equal(f.mode.phase,'off');assert.deepEqual(f.calls.slice(-2),['unlock','exit']);
});
test('permission rejection exits fullscreen and leaves normal mode usable',async()=>{
 const f=fixture({denied:true});await assert.rejects(f.mode.enter(),/Permission denied/);
 assert.equal(f.mode.phase,'off');assert.equal(f.host.fullscreen(),false);assert.ok(f.calls.includes('unlock'));
 const unsupported=fixture({keyboard:undefined});await assert.rejects(unsupported.mode.enter(),/unavailable/);assert.deepEqual(unsupported.calls,[]);
});
test('external fullscreen exit cancels a pending permission request and never relocks automatically',async()=>{
 let resolve;const f=fixture();f.host.keyboard.lock=()=>new Promise(done=>{resolve=done;});
 const entry=f.mode.enter();await Promise.resolve();f.setFull(false);f.mode.fullscreenChanged();
 assert.equal(f.mode.phase,'off');resolve();await entry;assert.equal(f.mode.phase,'off');assert.equal(f.calls.filter(x=>x==='fullscreen').length,1);
});
test('denied fullscreen and existing fullscreen do not request keyboard lock',async()=>{
 const f=fixture({enter:async()=>{throw Error('Fullscreen denied');}});await assert.rejects(f.mode.enter(),/Fullscreen denied/);assert.equal(f.mode.phase,'off');assert.deepEqual(f.calls,['unlock']);
 const existing=fixture();existing.setFull(true);await assert.rejects(existing.mode.enter(),/Exit fullscreen/);assert.deepEqual(existing.calls,[]);
});
