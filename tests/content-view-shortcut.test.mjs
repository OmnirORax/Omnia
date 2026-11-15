import test from 'node:test';
import assert from 'node:assert/strict';
import {handleContentViewShortcut} from '../src/ui/contentViewShortcut.ts';
const key=(extra={})=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:'v',...extra});return event;};
test('V toggles content once per press, consumes repeats, and supports caps lock',()=>{
 let on=false,count=0;const toggle=()=>{on=!on;count++;};const event=key();assert.equal(handleContentViewShortcut(event,false,toggle),true);assert.equal(event.defaultPrevented,true);assert.equal(on,true);
 handleContentViewShortcut(key({repeat:true}),false,toggle);assert.equal(count,1);handleContentViewShortcut(key({key:'V'}),false,toggle);assert.equal(on,false);
});
test('V remains text and modified V remains available to the editor/clipboard',()=>{
 let calls=0;const typed=key();assert.equal(handleContentViewShortcut(typed,true,()=>calls++),false);assert.equal(typed.defaultPrevented,false);
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{key:'x'}]){const event=key(extra);assert.equal(handleContentViewShortcut(event,false,()=>calls++),false);assert.equal(event.defaultPrevented,false);}
 assert.equal(calls,0);
});
