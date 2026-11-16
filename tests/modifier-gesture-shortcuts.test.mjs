import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesShortcut,normalizeShortcut,shortcutEvent} from '../src/ui/shortcuts.ts';
import {createSelection} from '../src/core/selection.ts';
import {releaseRange} from '../src/world/rangeSelection.ts';
const key=(name,shift=false)=>({key:name,ctrlKey:name==='Control',shiftKey:name==='Shift'||shift,altKey:name==='Alt',metaKey:name==='Meta'});
test('standalone modifiers never match mouse gesture descriptions',()=>{
 assert.equal(shortcutEvent(key('Control'),'Omnium'),undefined);assert.equal(normalizeShortcut('Alt+Right click'),undefined);
 for(const modifier of ['Control','Shift','Alt','Meta'])for(const gesture of ['Alt+Right click','Right drag','MB3 + scroll','Ctrl + drag','Ctrl + Shift + drag',''])assert.equal(matchesShortcut(key(modifier),gesture),false,`${modifier} / ${gesture}`);
 assert.equal(matchesShortcut(key('Control',true),'Alt+Right click'),false);
});
for(const depth of [false,true])test(`Ctrl${depth?'+Shift':''} selection cannot activate Face node before the drag`,()=>{
 const selection=createSelection((a,b)=>a===b);let picker=0;
 const actions=[{key:'Alt+Right click',run:()=>{picker++;selection.request(()=>true);}},{key:'N',run:()=>{throw Error('unrelated action');}}];
 for(const event of [key('Control'),...(depth?[{...key('Shift'),ctrlKey:true}]:[])])actions.find(action=>matchesShortcut(event,action.key))?.run();
 assert.equal(picker,0);assert.equal(selection.requesting,false);
 releaseRange({mode:'range',pointer:1,button:0,dragged:true,volume:depth?{}:undefined},{pointerId:1,button:0,preventDefault(){},stopImmediatePropagation(){}},{candidates:()=>['one','two'],finish(){},range:ids=>{if(!selection.requesting)selection.set(ids);},pick:id=>selection.pick(id)});
 assert.deepEqual(selection.committed,['one','two']);
});
