import test from 'node:test';
import assert from 'node:assert/strict';
import {blockBrowserShortcut,enableBrowserShortcuts,installBrowserShortcutGuard} from '../src/ui/browserShortcuts.ts';
test('browser defaults are blocked without stopping website handlers and can be enabled',()=>{
 for(const key of ['w','f4','t','r','f','3']){
  const event=new Event('keydown',{cancelable:true});Object.assign(event,{key,ctrlKey:true});
  blockBrowserShortcut(event);assert.equal(event.defaultPrevented,true,key);
 }
 const fullscreen=new Event('keydown',{cancelable:true});Object.assign(fullscreen,{key:'F11'});blockBrowserShortcut(fullscreen);assert.equal(fullscreen.defaultPrevented,false,'F11 belongs to the immersive handler, not the generic blocker');
 const copy=new Event('keydown',{cancelable:true});Object.assign(copy,{key:'c',ctrlKey:true});blockBrowserShortcut(copy);assert.equal(copy.defaultPrevented,false);
 enableBrowserShortcuts(true);
 const close=new Event('keydown',{cancelable:true});Object.assign(close,{key:'F4',ctrlKey:true});blockBrowserShortcut(close);assert.equal(close.defaultPrevented,false);
 enableBrowserShortcuts(false);
});

test('shared guard runs after focused handlers even when they stop propagation',()=>{
 const root=new EventTarget(),focus=new EventTarget(),calls=[];
 focus.addEventListener('keydown',event=>{calls.push(['command',event.defaultPrevented]);event.stopPropagation();});
 installBrowserShortcutGuard(root);
 const key=()=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:'4',ctrlKey:true});Object.defineProperty(event,'composedPath',{value:()=>[focus,root]});return event;};
 const event=key();root.dispatchEvent(event);assert.equal(event.defaultPrevented,false);focus.dispatchEvent(event);
 assert.deepEqual(calls,[['command',false]]);assert.equal(event.defaultPrevented,true);
 enableBrowserShortcuts(true);const allowed=key();root.dispatchEvent(allowed);focus.dispatchEvent(allowed);assert.equal(allowed.defaultPrevented,false);enableBrowserShortcuts(false);
});

test('global protection covers modified browser commands while preserving native editing',()=>{
 for(const extra of [{key:'4',ctrlKey:true},{key:'i',ctrlKey:true,shiftKey:true},{key:'c',ctrlKey:true,shiftKey:true},{key:'F7'},{key:'f',altKey:true}]){
  const event=new Event('keydown',{cancelable:true});Object.assign(event,extra);blockBrowserShortcut(event);assert.equal(event.defaultPrevented,true,JSON.stringify(extra));
 }
 for(const extra of [{key:'c',ctrlKey:true},{key:'v',ctrlKey:true,shiftKey:true},{key:'ArrowLeft',ctrlKey:true,shiftKey:true},{key:'Backspace',metaKey:true},{key:'€',ctrlKey:true,altKey:true,getModifierState:key=>key==='AltGraph'}]){
  const event=new Event('keydown',{cancelable:true});Object.assign(event,extra);blockBrowserShortcut(event);assert.equal(event.defaultPrevented,false,JSON.stringify(extra));
 }
});

test('Windows-key combinations and Alt+Tab remain available while Mac browser shortcuts are guarded',()=>{
 for(const extra of [{key:'Meta',metaKey:true},{key:'e',metaKey:true},{key:'Tab',altKey:true}]){
  const event=new Event('keydown',{cancelable:true});Object.assign(event,extra);blockBrowserShortcut(event,false);assert.equal(event.defaultPrevented,false);
 }
 const mac=new Event('keydown',{cancelable:true});Object.assign(mac,{key:'q',metaKey:true});blockBrowserShortcut(mac,true);assert.equal(mac.defaultPrevented,true);
});
