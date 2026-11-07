import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyUILayout,validateUILayout,ownerOf} from '../src/ui/layout.ts';
import {resetResidentHome,canResetResidentHome} from '../src/ui/residentHome.ts';
const windowState=()=>({x:20,y:30,width:300,height:250,collapsed:false,pinned:false});
const setup=()=>{
 const original={...emptyUILayout(),windows:{home:{...windowState(),members:[{kind:'function',id:'before'},{kind:'function',id:'moved'},{kind:'function',id:'after'}]},other:windowState()}};
 const homes={original,windows:new Map(),functions:[{id:'before'},{id:'moved'},{id:'after'},{id:'native'}]};
 return {original,homes};
};
test('default-home recovery works after saving/reloading and preserves unrelated authored UI',()=>{
 const {original,homes}=setup();
 const style={mode:'icon',geometry:'circle',character:'★'};
 const saved={...structuredClone(original),items:{moved:{x:500,y:600,home:false,style,size:{width:90,height:80}}},labels:{'function:moved':'My name'},uiRigidity:{all:false}};
 saved.windows.home.members=saved.windows.home.members.filter(m=>m.id!=='moved');
 saved.windows.other.members=[{kind:'function',id:'moved',position:{x:40,y:50}},{kind:'function',id:'native'}];
 const reloaded=validateUILayout(JSON.parse(JSON.stringify(saved))),before=JSON.stringify(reloaded);
 const reset=resetResidentHome(reloaded,'function:moved',homes);
 assert.equal(ownerOf(reset,'function:moved'),'window:home');
 assert.deepEqual(reset.windows.home.members.map(m=>m.id),['before','moved','after']);
 assert.deepEqual(reset.windows.other.members.map(m=>m.id),['native']);
 assert.deepEqual(reset.items.moved.style,style);assert.equal(reset.items.moved.size,undefined);
 assert.deepEqual(reset.labels,reloaded.labels);assert.deepEqual(reset.uiRigidity,reloaded.uiRigidity);
 assert.equal(JSON.stringify(reloaded),before,'recovery is an immutable existing-format transaction');
 assert.deepEqual(resetResidentHome(reset,'function:moved',homes),reset,'repeat recovery is stable');
});
test('native controls return to their real source slot without losing styling or dragging peers along',()=>{
 const {original,homes}=setup();
 const layout={...original,items:{native:{x:10,y:20,home:false,anchorId:'other|before',style:{mode:'text',geometry:'circle'}},peer:{x:0,y:0,home:false,anchorId:'native|source'}},nativeOrders:{'other|before':['before','native'],'native|source':['native','peer']}};
 const reset=resetResidentHome(layout,'function:native',homes);
 assert.equal(reset.items.native.home,true);assert.equal(reset.items.native.anchorId,undefined);
 assert.deepEqual(reset.items.native.style,layout.items.native.style);
 assert.deepEqual(reset.items.peer,layout.items.peer);
 assert.deepEqual(reset.nativeOrders,{'other|before':['before'],'native|source':['peer']});
});
test('embedded frames return to their declared home after reload while retaining contents and chrome',()=>{
 const {original,homes}=setup();const initial={...windowState(),inline:{parent:'window:home'}};
 homes.windows.set('section',initial);
 const layout={...original,windows:{...original.windows,section:{...initial,x:600,y:500,inline:{parent:'window:home',detached:true},members:[{kind:'function',id:'native'}],chrome:{style:{mode:'icon',geometry:'circle',character:'X'}}}}};
 const reset=resetResidentHome(validateUILayout(JSON.parse(JSON.stringify(layout))),'window:section',homes);
 assert.equal(ownerOf(reset,'window:section'),'window:home');
 assert.equal(reset.windows.section.inline.detached,false);assert.equal(reset.windows.section.x,initial.x);
 assert.deepEqual(reset.windows.section.members,layout.windows.section.members);
 assert.deepEqual(reset.windows.section.chrome,layout.windows.section.chrome);
 assert.deepEqual(reset.windows.home.members,original.windows.home.members,'native inline homes must not acquire duplicate explicit membership');
});
test('recovery respects protected destinations, source pins, cycles and unavailable homes',()=>{
 const {original,homes}=setup();let layout=structuredClone(original);
 layout.windows.home.members=layout.windows.home.members.filter(m=>m.id!=='moved');
 layout.windows.other.members=[{kind:'function',id:'moved'}];
 layout.windows.home.pinned=true;assert.equal(canResetResidentHome(layout,'function:moved',homes),false);
 assert.equal(resetResidentHome(layout,'function:moved',homes),layout);
 layout.windows.home.pinned=false;layout.windows.other.pinned=true;
 assert.equal(resetResidentHome(layout,'function:moved',homes),layout);
 assert.equal(canResetResidentHome(layout,'frame:user-created',homes),false);
 assert.equal(canResetResidentHome(layout,'function:unknown',homes),false);
 const native={...windowState(),inline:{parent:'window:home',detached:true},members:[{kind:'window',id:'home'}]};
 homes.windows.set('section',{...windowState(),inline:{parent:'window:home'}});
 const cycle={...original,windows:{...original.windows,section:native}};
 assert.equal(resetResidentHome(cycle,'window:section',homes),cycle,'never move an ancestor inside its child');
});
test('a missing default window is restored without stealing its other moved residents',()=>{
 const {original,homes}=setup();const layout={...original,windows:{other:{...windowState(),members:[{kind:'function',id:'moved'},{kind:'function',id:'after'}]}}};
 const reset=resetResidentHome(layout,'function:moved',homes);
 assert.equal(ownerOf(reset,'function:moved'),'window:home');assert.equal(ownerOf(reset,'function:after'),'window:other');
 assert.deepEqual(reset.windows.home.members,[{kind:'function',id:'moved'}]);
});

test('window recovery repairs tab membership while preserving other tabs and internal organization',()=>{
 const section={...windowState(),members:[{kind:'function',id:'native',position:{x:30,y:40}}]};
 const original={...emptyUILayout(),windows:{home:{...windowState(),members:[{kind:'window',id:'sibling'},{kind:'window',id:'section'}]},sibling:windowState(),section}};
 const homes={original,windows:new Map(),functions:[{id:'native'}]};
 const layout={...structuredClone(original),windows:{...structuredClone(original.windows),home:{...windowState(),members:[{kind:'window',id:'sibling'}],dockLayout:{kind:'tabs',keys:['window:sibling'],active:'window:sibling'}}}};
 const reset=resetResidentHome(validateUILayout(layout),'window:section',homes);
 assert.deepEqual(reset.windows.home.dockLayout.keys,['window:sibling','window:section']);
 assert.deepEqual(reset.windows.section.members,section.members);
 assert.deepEqual(validateUILayout(reset),reset);
});

test('context-owned actions cannot escape their source through default-home recovery',()=>{
 const {original,homes}=setup();homes.functions.push({id:'context:node:delete'});
 assert.equal(canResetResidentHome(original,'function:context:node:delete',homes),false);
 assert.equal(resetResidentHome(original,'function:context:node:delete',homes),original);
});


test('shipped menu recovery restores a real default-home button after a serialized move',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {dockResident}=await import('../src/ui/layout.ts');
 const original=validateUILayout(JSON.parse(await readFile(new URL('../src/ui/default-template.json',import.meta.url),'utf8')).layout);
 const homes={original,windows:new Map(),functions:[{id:'ui:export'}]};
 const moved=dockResident(original,'function:ui:export','window:panel:menu:create',0);
 const reloaded=validateUILayout(JSON.parse(JSON.stringify(moved)));
 const reset=resetResidentHome(reloaded,'function:ui:export',homes);
 assert.equal(ownerOf(reset,'function:ui:export'),'window:panel:menu:file');
 assert.deepEqual(reset.windows['panel:menu:file'].members,original.windows['panel:menu:file'].members);
 assert.deepEqual(reset.windows['panel:menu:create'].members,original.windows['panel:menu:create'].members);
});


test('user-created controls with no canonical home remain recoverable in their current placement',()=>{
 const {original,homes}=setup();homes.functions.push({id:'custom'});
 const layout={...original,customControls:{custom:{kind:'text',label:'Mine',value:'authored'}},items:{custom:{x:40,y:50,home:false}}};
 assert.equal(canResetResidentHome(layout,'function:custom',homes),false);
 assert.equal(resetResidentHome(layout,'function:custom',homes),layout);
});
