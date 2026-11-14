import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionHistory} from '../src/composer/runtime/ui/actionHistory.ts';
import {createViewHistory,VIEW_CLOSE,VIEW_GEOMETRY} from '../src/ui/viewHistory.ts';
const journal=()=>createActionHistory({mode:'recent',steps:1,limit:10,minimum:1,categories:['ui','omnium','camera']});
class Root extends EventTarget{dataset={};style={cssText:'left:10px;top:20px'};isConnected=true;}
function handle(){const root=new Root();return {root,close(){if(this.busy)return false;root.dispatchEvent(new Event(VIEW_CLOSE));root.isConnected=false;},busy:false};}
const settle=()=>Promise.resolve();
function fixture(){const history=journal(),frames=[],views=createViewHistory(history,fn=>frames.push(fn)),rendered=[];views.menuRenderer(spec=>rendered.push(spec?.kind??null));return {history,views,rendered,frame:()=>{for(const run of frames.splice(0))run();}};}

test('menus and their queries travel backward and forward without adding replay entries',async()=>{
 const {history,views,rendered}=fixture();views.menu({kind:'scene'});views.menu({kind:'visuals'});views.query('opacity');
 assert.equal(history.candidates('undo').length,3);history.travel('undo');await settle();assert.equal(views.state.menu.query,undefined);
 history.travel('undo');await settle();assert.equal(rendered.at(-1),'scene');history.travel('redo');await settle();assert.equal(rendered.at(-1),'visuals');
 history.travel('redo');await settle();assert.equal(views.state.menu.query,'opacity');assert.equal(history.candidates('undo').length,3);
});
test('opening a window replaces a menu in one action; redo builds a fresh working view',async()=>{
 const {history,views,rendered,frame}=fixture();let current,created=0,edits=0;
 views.factory('settings',spec=>{created++;current=handle();current.edit=()=>edits++;views.adopt('settings',spec,current,spec);});
 views.menu({kind:'scene'});current=handle();views.perform(()=>views.adopt('settings',{kind:'settings'},current));frame();const original=current;
 assert.equal(history.candidates('undo').length,2);assert.equal(history.travel('undo'),1);await settle();assert.equal(original.root.isConnected,false);assert.equal(rendered.at(-1),'scene');
 assert.equal(history.travel('redo'),1);await settle();frame();assert.equal(created,1);assert.notEqual(current,original);current.edit();assert.equal(edits,1);assert.equal(rendered.at(-1),null);
});
test('closing and reopening preserves geometry and keeps geometry undo connected',async()=>{
 const {history,views,frame}=fixture();let current=handle();views.factory('document',spec=>{current=handle();views.adopt('document',spec,current,spec);});
 views.adopt('document',{kind:'document',args:['node']},current);frame();current.root.style.cssText='left:80px;top:90px';current.root.dispatchEvent(new Event(VIEW_GEOMETRY));current.close();
 history.travel('undo');await settle();frame();assert.equal(current.root.style.cssText,'left:80px;top:90px');
 history.travel('undo');assert.equal(current.root.style.cssText,'left:10px;top:20px');history.travel('redo');assert.equal(current.root.style.cssText,'left:80px;top:90px');
 history.travel('redo');await settle();assert.equal(current.root.isConnected,false);
});
test('one action spanning data and UI reverses and reapplies atomically',async()=>{
 const {history,views,frame}=fixture();let data={value:0},current=handle();history.register('data',{read:()=>data,write:value=>data=value});
 views.factory('composer',spec=>{assert.equal(data.value,1);current=handle();views.adopt('composer',spec,current,spec);});
 views.perform(()=>{const before=data;data={value:1};history.record('data',before,data,['omnium'],['omnium']);views.adopt('composer',{kind:'composer'},current);});frame();
 assert.equal(history.candidates('undo').length,1);assert.equal(history.travel('undo'),1);await settle();assert.equal(data.value,0);assert.equal(current.root.isConnected,false);
 assert.equal(history.travel('redo'),1);await settle();frame();assert.equal(data.value,1);assert.equal(current.root.isConnected,true);assert.equal(history.candidates('undo').length,1);
});
test('busy close veto leaves history intact and restores any windows already closed',async()=>{
 const {history,views,frame}=fixture();let first=handle(),second=handle();second.busy=true;
 views.factory('first',spec=>{first=handle();views.adopt('first',spec,first,spec);});
 views.perform(()=>{views.adopt('first',{kind:'first'},first);views.adopt('second',{kind:'second'},second);});frame();
 assert.equal(history.travel('undo'),0);await settle();frame();assert.equal(first.root.isConnected,true);assert.equal(second.root.isConnected,true);assert.equal(history.candidates('undo').length,1);
});
test('late async replay cannot reopen a window after redo closed it again',async()=>{
 const {history,views,frame}=fixture();let complete;const original=handle();
 views.factory('library',spec=>{complete=()=>{const late=handle();views.adopt('library',spec,late,spec);return late;};});
 views.adopt('library',{kind:'library'},original);frame();original.close();history.travel('undo');await settle();assert.equal(typeof complete,'function');
 history.travel('redo');await settle();const late=complete();assert.equal(late.root.isConnected,false);assert.equal(views.state.windows.library,undefined);assert.equal(history.candidates('redo').length,0);
});
test('transaction preflights all owners before writes and rolls back earlier writes on failure',()=>{
 const history=journal();let a={n:0},b={n:0},fail=false;history.register('a',{read:()=>a,write:value=>a=value});history.register('b',{read:()=>b,write:value=>{if(fail)throw Error('busy');b=value;}});
 history.transaction(()=>{let before=b;b={n:1};history.record('b',before,b,['omnium'],['omnium']);before=a;a={n:1};history.record('a',before,a,['ui'],['omnium']);});
 fail=true;assert.equal(history.travel('undo'),0);assert.deepEqual(a,{n:1});assert.deepEqual(b,{n:1});fail=false;
 b={n:2};assert.equal(history.travel('undo'),0);assert.deepEqual(a,{n:1});b={n:1};assert.equal(history.travel('undo'),1);assert.deepEqual(a,{n:0});assert.deepEqual(b,{n:0});
});
test('single-owner transactions coalesce like existing field edits and nested no-ops disappear',()=>{
 const history=journal();let state={value:0};history.register('field',{read:()=>state,write:value=>state=value});
 const edit=value=>{const before=state;state={value};history.record('field',before,state,['ui'],['omnium'],'field');};
 history.transaction(()=>edit(1));history.transaction(()=>edit(2));assert.equal(history.candidates('undo').length,1);history.travel('undo');assert.equal(state.value,0);
 const other=journal();let value={n:0};other.register('x',{read:()=>value,write:v=>value=v});other.transaction(()=>{const before=value;value={n:1};other.record('x',before,value,['ui'],['omnium']);other.transaction(()=>{const prior=value;value={n:0};other.record('x',prior,value,['ui'],['omnium']);});});assert.equal(other.candidates('undo').length,0);
});

test('a single browser action groups model changes and popup navigation, including async completion',async()=>{
 const previous=globalThis.window;globalThis.window={event:{type:'click',timeStamp:12}};
 try{
  const {history,views,frame}=fixture();let data={n:0};history.register('model',{read:()=>data,write:value=>data=value});
  const id=history.currentActionId,before=data;data={n:1};history.record('model',before,data,['omnium'],['omnium']);
  views.menu({kind:'options'});globalThis.window.event=undefined;
  views.perform(()=>views.adopt('editor',{kind:'editor'},handle()),id);frame();
  assert.equal(history.candidates('undo').length,1);assert.equal(history.travel('undo'),1);await settle();assert.equal(data.n,0);assert.equal(views.state.menu,null);assert.deepEqual(views.state.windows,{});
 }finally{globalThis.window=previous;}
});
test('async completion does not merge across an intervening independent action',()=>{
 const {history,views}=fixture();let value={n:0};history.register('model',{read:()=>value,write:next=>value=next});
 history.transaction(()=>{const before=value;value={n:1};history.record('model',before,value,['omnium'],['omnium']);},'first');
 views.menu({kind:'second'});views.perform(()=>views.adopt('editor',{kind:'editor'},handle()),'first');
 assert.equal(history.candidates('undo').length,3);
});
test('shared window declaration supplies disposal and recreation without custom undo callbacks',async()=>{
 const {history,views,frame}=fixture();let current,builds=0;
 const open=views.defineWindow('dialog',label=>{builds++;current=handle();current.label=label;return current;});
 open('hello');frame();const first=current;history.travel('undo');await settle();assert.equal(first.root.isConnected,false);
 history.travel('redo');await settle();frame();assert.equal(builds,2);assert.equal(current.label,'hello');assert.notEqual(current,first);
 current.close();history.travel('undo');await settle();frame();assert.equal(builds,3);assert.equal(current.root.isConnected,true);
});
test('window route changes restore the previous page through the common lifecycle',async()=>{
 const {history,views,frame}=fixture();let current;
 const open=views.defineWindow('settings',tab=>{current=handle();current.tab=tab;return current;});open('image');frame();
 const route=new Event('omnium:window-route');route.detail=['audio'];current.root.dispatchEvent(route);
 assert.deepEqual(views.state.windows.settings.args,['audio']);history.travel('undo');await settle();frame();assert.equal(current.tab,'image');
 history.travel('redo');await settle();frame();assert.equal(current.tab,'audio');
});
test('pending field commits are included before an undo inside the same transaction',()=>{
 const history=journal();let value={n:0};history.register('model',{read:()=>value,write:next=>value=next});
 history.transaction(()=>{const before=value;value={n:1};history.record('model',before,value,['omnium'],['omnium']);assert.equal(history.travel('undo'),1);});
 assert.equal(value.n,0);assert.equal(history.candidates('redo').length,1);
});
test('deferred mounts remain in restoration until their actual lifecycle completes',async()=>{
 const {views,frame}=fixture();let mounted;const ready=new Promise(resolve=>mounted=resolve),current={...handle(),ready};
 views.adopt('async',{kind:'async'},current);frame();assert.equal(views.restoring,true);mounted();await settle();frame();assert.equal(views.restoring,false);
});
test('initial menu filtering does not add an empty search action ahead of the first right-click',async()=>{
 const {history,views,rendered}=fixture();
 // Main menus run their initial filter on the next animation frame.
 views.menu({kind:'context',point:{x:20,y:30}});await settle();views.query('');
 assert.equal(history.candidates('undo').length,1);
 assert.equal(history.travel('undo'),1);await settle();assert.equal(rendered.at(-1),null);assert.equal(views.state.menu,null);
 assert.equal(history.travel('redo'),1);await settle();views.query('');assert.equal(rendered.at(-1),'context');assert.equal(history.candidates('redo').length,0);assert.equal(history.candidates('undo').length,1);
});
