import test from 'node:test';
import assert from 'node:assert/strict';
import {createImmersiveMode,handleImmersiveShortcut} from '../src/ui/immersiveMode.ts';
function fixture(options={}){
 let full=false;const calls=[];
 const host={keyboard:{lock:async keys=>{calls.push(['lock',keys]);if(options.denied)throw Error('Permission denied');},unlock:()=>calls.push('unlock')},fullscreen:()=>full,enter:async()=>{calls.push('fullscreen');full=true;},exit:async()=>{calls.push('exit');full=false;},changed:()=>{},...options};
 return {mode:createImmersiveMode(host),host,calls,setFull:value=>{full=value;}};
}
test('fullscreen entry locks all browser-supported keys; leaving releases the keyboard lock',async()=>{
 const f=fixture();assert.equal(f.mode.phase,'off');assert.deepEqual(f.calls,[]);
 await f.mode.enter();assert.equal(f.mode.phase,'active');assert.deepEqual(f.calls,['fullscreen',['lock',undefined]]);
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

test('F11 invokes the immersive toggle before local handlers, consumes repeats and preserves modified keys',()=>{
 let calls=0;
 const key=(extra={})=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{key:'F11',...extra});return e;};
 const enter=key();assert.equal(handleImmersiveShortcut(enter,()=>calls++),true);assert.equal(enter.defaultPrevented,true);assert.equal(calls,1);
 const repeat=key({repeat:true});handleImmersiveShortcut(repeat,()=>calls++);assert.equal(repeat.defaultPrevented,true);assert.equal(calls,1);
 const leave=key();handleImmersiveShortcut(leave,()=>calls++);assert.equal(calls,2);
 for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{key:'F4'},{key:'Escape'}]){const e=key(extra);assert.equal(handleImmersiveShortcut(e,()=>calls++),false);assert.equal(e.defaultPrevented,false);}
 assert.equal(calls,2);
});
