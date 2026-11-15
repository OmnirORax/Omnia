import test from 'node:test';
import assert from 'node:assert/strict';
import {blockBrowserShortcut,enableBrowserShortcuts} from '../src/ui/browserShortcuts.ts';
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
