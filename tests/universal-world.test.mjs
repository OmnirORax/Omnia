import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionHistory} from '../src/composer/runtime/ui/actionHistory.ts';
import {createStore} from '../src/core/store.ts';
import {emptyWorld,addStructure,locate,validateWorld} from '../src/core/model.ts';
import {toggleSubtree,childNode} from '../src/core/nodeOperations.ts';
import {transformNodes} from '../src/core/navigation.ts';
import {geometry,address,lattice} from '../src/core/lattice.ts';
import {NAV_DEFAULTS} from '../src/navigation/options.ts';
import {installHistoryBindings} from '../src/ui/historyBindings.ts';

const journal=()=>createActionHistory({mode:'recent',steps:1,limit:10,minimum:1,categories:['omnium','camera','ui','appearance','settings']});
function fixture(){let saved=null,writes=0;const history=journal(),store=createStore({getItem:()=>saved,setItem:(_key,value)=>{saved=value;writes++;}},history);let origin;store.change(world=>origin=addStructure(world,[0,0,0],1).origin);return {store,history,origin,writes:()=>writes};}

test('camera and workspace actions undo and redo in one chronological timeline',()=>{
 const {store,history,origin,writes}=fixture();let camera={position:[0,0,10]};
 history.register('camera',{read:()=>camera,write:value=>camera=value});
 const beforeWrites=writes();const before=camera;camera={position:[4,0,10]};history.record('camera',before,camera,['camera'],['omnium']);assert.equal(writes(),beforeWrites);
 store.change(world=>locate(world,origin).label='Named');
 store.undo();assert.equal(locate(store.world,origin).label,'');assert.equal(camera.position[0],4);
 store.undo();assert.equal(camera.position[0],0);store.undo();assert.equal(store.world.nodes.length,0);
 store.redo();store.redo();store.redo();assert.equal(locate(store.world,origin).label,'Named');assert.equal(camera.position[0],4);
});
test('native composer owner and unrelated node properties share history without duplicate draft entries',()=>{
 const {store,history,origin}=fixture();
 const read=()=>({label:locate(store.world,origin).label});
 history.register('composer',{read,write:value=>store.change(w=>locate(w,origin).label=value.label,'composer:draft')});
 const before=read();store.change(w=>locate(w,origin).label='Draft','composer:draft');history.record('composer',before,read(),['omnium'],['omnium','window:omnic-composer']);
 store.change(w=>locate(w,origin).glow=.8);
 store.undo();assert.equal(locate(store.world,origin).glow,undefined);assert.equal(locate(store.world,origin).label,'Draft');
 store.undo();assert.equal(locate(store.world,origin).label,'');store.undo();assert.equal(store.world.nodes.length,0);
 store.redo();store.redo();store.redo();assert.equal(locate(store.world,origin).label,'Draft');assert.equal(locate(store.world,origin).glow,.8);
});
test('selective camera undo preserves later workspace edits and schema promotion stays sticky',()=>{
 const {store,history,origin}=fixture();let camera={x:0};history.register('camera',{read:()=>camera,write:v=>camera=v});
 const before=camera;camera={x:5};history.record('camera',before,camera,['camera'],['omnium']);
 store.change(w=>{w.version=3;locate(w,origin).label='Preserved';});
 history.configure({mode:'selective',categories:['camera']});store.undo();assert.equal(camera.x,0);assert.equal(locate(store.world,origin).label,'Preserved');
 history.configure({mode:'recent'});store.undo();store.undo();assert.equal(store.world.version,3);assert.equal(store.world.nodes.length,0);
});
test('saved orientation rotates only the requested nodes and round-trips with undo',()=>{
 const {store,origin}=fixture();let child;
 store.change(w=>{child=addStructure(w,[2,0,0],2).origin;locate(w,child).parent=origin;});
 const before=locate(store.world,child).position;
 store.change(w=>transformNodes(w,[origin],{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},{x:0,y:0,z:0},false));
 assert.deepEqual(locate(store.world,child).position,before);assert.equal(locate(store.world,origin).orientation.y,Math.SQRT1_2);
 assert.deepEqual(validateWorld(JSON.parse(JSON.stringify(store.world))).nodes[0].orientation,geometry(store.world).placements[0].orientation);
 store.undo();assert.equal(locate(store.world,origin).orientation,undefined);store.redo();assert.equal(locate(store.world,origin).orientation.y,Math.SQRT1_2);
});
test('layout rotation keeps unselected children fixed and rejects occupied landings atomically',()=>{
 const world=emptyWorld(),a=addStructure(world,[1,0,0],1),child=addStructure(world,[2,0,0],2);child.parent=a.origin;
 transformNodes(world,[a.origin],{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},{x:0,y:0,z:0},true);
 assert.deepEqual(a.position.map(n=>n===0?0:n),[0,0,-1]);assert.deepEqual(child.position,[2,0,0]);assert.equal(lattice(world).cells.get(address(a.origin)).z,-1);
 const {store,origin}=fixture();store.change(w=>addStructure(w,[1,0,1],2));
 const before=store.world;
 assert.throws(()=>store.change(w=>transformNodes(w,[origin],{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},{x:1,y:0,z:0},true)),/occupied/);
 assert.equal(store.world,before);
});
test('invalid orientations and navigation settings cannot enter saved worlds',()=>{
 for(const orientation of [null,{x:0,y:0,z:0,w:0},{x:0,y:0,z:0,w:Infinity}]){const world=emptyWorld(),node=addStructure(world,[0,0,0],1);node.orientation=orientation;assert.throws(()=>validateWorld(world),/orientation/);}
 const world=emptyWorld();world.settings.navigation={...NAV_DEFAULTS,axis:'invalid'};assert.throws(()=>validateWorld(world),/navigation/);
});
test('MB4/MB5 suppress browser navigation without duplicate compatibility actions',()=>{
 const previous=globalThis.window,handlers=new Map(),calls=[];
 globalThis.window={addEventListener:(name,fn)=>handlers.set(name,fn)};
 try{
  installHistoryBindings({undo:()=>calls.push('undo'),redo:()=>calls.push('redo'),configure:()=>calls.push('configure'),flush:()=>calls.push('flush')});
  const send=(type,button,shiftKey=false,extra={})=>{const event={button,shiftKey,ctrlKey:false,metaKey:false,altKey:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};handlers.get(type)(event);assert.equal(event.defaultPrevented,true);return event;};
  send('pointerdown',3);send('mousedown',3);send('pointerup',3);send('mouseup',3);send('auxclick',3);assert.deepEqual(calls,['flush','undo']);
  send('pointerdown',4);send('mousedown',4);send('mouseup',4);assert.deepEqual(calls.slice(-2),['flush','redo']);
  send('pointerdown',3,true);send('mouseup',3,true);assert.equal(calls.at(-1),'configure');
  send('keydown',0,false,{key:'z',ctrlKey:true});assert.equal(calls.at(-1),'undo');
  send('keydown',0,true,{key:'z',ctrlKey:true});assert.equal(calls.at(-1),'redo');
 }finally{globalThis.window=previous;}
});

test('V1 subtree toggle expands every authored level then collapses the whole branch',()=>{
 const world=emptyWorld(),root=addStructure(world,[0,0,0],1),child=childNode(world,root.origin),leaf=childNode(world,child.origin),hidden=childNode(world,root.origin),variant=childNode(world,root.origin,true);
 root.collapsed=true;child.collapsed=true;hidden.hidden=true;hidden.collapsed=true;variant.collapsed=true;
 toggleSubtree(world,root.origin);assert.equal(root.collapsed,false);assert.equal(child.collapsed,false);assert.equal(leaf.collapsed,false);assert.equal(hidden.collapsed,true);assert.equal(variant.collapsed,true);
 toggleSubtree(world,root.origin);assert.equal(root.collapsed,true);assert.equal(child.collapsed,true);assert.equal(leaf.collapsed,true);
 toggleSubtree(world,root.origin);assert.equal(root.collapsed,false);assert.equal(child.collapsed,false);
});
