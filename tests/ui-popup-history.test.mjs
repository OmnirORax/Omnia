import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionHistory} from '../src/composer/runtime/ui/actionHistory.ts';
import {createNavigationState} from '../src/ui/navigationState.ts';
import {createViewHistory} from '../src/ui/viewHistory.ts';
const journal=()=>createActionHistory({mode:'recent'});
test('popup points and stages restore through one keyed state owner without notifying unrelated controls',()=>{
 const history=journal(),state=createNavigationState(history);let a=0,b=0;
 state.read('native/first',null);state.read('native/second',null);const stop=state.subscribe('native/first',()=>a++),other=state.subscribe('native/second',()=>b++);
 history.transaction(()=>{state.set('native/first',{point:{x:20,y:30},stage:'amount'});});
 assert.equal(a,1);assert.equal(b,0);history.travel('undo');assert.equal(state.read('native/first',null),null);assert.equal(a,2);assert.equal(b,0);
 stop();history.travel('redo');assert.deepEqual(state.read('native/first',null),{point:{x:20,y:30},stage:'amount'});other();
});
test('unmounted popup data survives while its window remains open or reopenable in history',async()=>{
 const history=journal(),views=createViewHistory(history,()=>{}),state=createNavigationState(history,()=>Object.values(views.state.windows).map(v=>`window:${v.instance}`));
 views.menu({kind:'context'});const spec=views.state.menu,key=`menu:${spec.instance}/details`;
 state.read(key,{stage:'amount'});const stop=state.subscribe(key,()=>{});views.hideMenu();stop();await Promise.resolve();assert.deepEqual(state.read(key,null),{stage:'amount'});
 const root=new EventTarget();root.dataset={};root.style={cssText:''};root.isConnected=true;views.adopt('base',{kind:'hud'}, {root,close(){root.isConnected=false;}},undefined,true);
 const active=`window:${views.state.windows.base.instance}/details`;state.read(active,{stage:'modes'});const stopActive=state.subscribe(active,()=>{});stopActive();await Promise.resolve();assert.deepEqual(state.read(active,null),{stage:'modes'});
 const orphan='window:9999/orphan';state.read(orphan,{old:true});const stopOrphan=state.subscribe(orphan,()=>{});stopOrphan();await Promise.resolve();assert.equal(state.read(orphan,null),null);
});
