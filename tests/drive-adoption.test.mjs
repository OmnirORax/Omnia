import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createNavigatorDrive} from '../src/navigation/navigatorDrive.ts';
import {createStore} from '../src/core/store.ts';
import {addStructure,locate} from '../src/core/model.ts';
import {geometry,address} from '../src/core/lattice.ts';
import {adoptNodes,childNode} from '../src/core/nodeOperations.ts';
function fixture(){const saved=new Map(),store=createStore({getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)});let a,b,parent;
 store.change(world=>{a=addStructure(world,[0,0,0],1).origin;b=addStructure(world,[2,0,0],2).origin;parent=addStructure(world,[5,0,0],3).origin;});
 const hosts=new Map(store.world.nodes.map(node=>{const group=new T.Group();group.position.set(...node.position);return [address(node.origin),{group,anchor:group.position}];}));
 const drive=createNavigatorDrive({hosts:()=>hosts,commit:()=>{throw Error('Adoption must use its own commit.');}});return {store,a,b,parent,drive,hosts};
}
test('placing a picked-up selection onto a parent adopts all roots in one undoable commit',()=>{
 const {store,a,b,parent,drive}=fixture(),origins=[a,b];drive.begin(geometry(store.world),address(a),1,1,origins.map(address));assert.ok(drive.move(new T.Vector3(4,0,0)));const before=structuredClone(store.world);
 assert.ok(drive.park(true,(_id,position)=>{assert.equal(drive.active,false);store.change(world=>adoptNodes(world,origins,parent,[position.x,position.y,position.z]));return geometry(store.world);}));
 for(const origin of origins)assert.deepEqual(locate(store.world,origin).parent,parent);assert.equal(locate(store.world,parent).parts.length,2);assert.equal(drive.active,false);
 store.undo();assert.deepEqual(store.world,before);store.redo();assert.deepEqual(locate(store.world,b).parent,parent);
});
test('adopting a node onto its descendant rejects the write and retains the reversible placement preview',()=>{
 const {store,a,drive}=fixture();let child;store.change(world=>{child=childNode(world,a).origin;});const before=store.world;
 drive.begin(geometry(store.world),address(a),1,1,[address(a)]);drive.move(new T.Vector3(0,4,0));assert.throws(()=>drive.park(true,()=>{store.change(world=>adoptNodes(world,[a],child,[0,4,0]));return geometry(store.world);}),/own branch/);
 assert.equal(store.world,before);assert.equal(drive.active,true);drive.cancel();assert.equal(drive.active,false);
});

test('a rejected placement constraint invalidates a drive without throwing, committing or blocking the next valid move',()=>{
 const {store,hosts,a}=fixture();let commits=0;const drive=createNavigatorDrive({hosts:()=>hosts,commit:()=>{commits++;return geometry(store.world);},constrain:(_id,p)=>{if(p.x<0)throw Error('Point is outside the active area.');return p;}});
 drive.begin(geometry(store.world),address(a),1,1,false);assert.equal(drive.move(new T.Vector3(-3,0,0)),false);assert.match(drive.rejection.reason,/outside the active area/);assert.equal(drive.park(),null);assert.equal(commits,0);assert.equal(drive.active,true);
 assert.equal(drive.move(new T.Vector3(0,4,0)),true);assert.equal(drive.rejection,undefined);drive.cancel();assert.deepEqual(hosts.get(address(a)).group.position.toArray(),[0,0,0]);assert.equal(commits,0);
});
