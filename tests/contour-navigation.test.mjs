import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createNavigationGesture} from '../src/navigation/gesture.ts';
import {NAV_DEFAULTS} from '../src/navigation/options.ts';
function setup(){
 const camera=new T.PerspectiveCamera(55,1,.01,1000),scene=new T.Scene(),target=new T.Vector3(),parent=new T.Group(),group=new T.Group();camera.position.set(0,2,10);camera.lookAt(target);parent.position.set(4,0,0);parent.add(group);scene.add(parent);
 const doc={placements:[{id:'a',parentId:null,position:{x:0,y:0},spatialPosition:{x:0,y:0,z:0}}]},selection=new Set(['a']),hosts=new Map([['a',{group,anchor:group.position}]]);let revision=0,committed;
 const engine=createNavigationGesture({camera,scene,canvas:{setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}},target:()=>target,nodes:()=>hosts,document:()=>doc,coordinates:()=>new Map([['a',{x:0,y:0,z:0}]]),displayPosition:()=>({x:parent.position.x,y:0,z:0}),viewRevision:()=>revision,selection:()=>selection,pointed:()=> 'a',request(){},enabled(){},rebind(){},feedback(){},commit:(...args)=>{committed=args;},remember(){}});
 return {camera,scene,target,parent,group,engine,get committed(){return committed;},revision:()=>revision++};
}
const down={pointerId:1,button:2,clientX:100,clientY:100};
test('camera orbit and its pivot follow the displaced node while canonical placement stays fixed',()=>{
 const h=setup(),before=h.camera.position.clone(),options={...NAV_DEFAULTS,mode:'orbit',actor:'camera',pivot:'pointed'};
 h.engine.preview(options,{x:100,y:100});const marker=h.scene.children.find(c=>c instanceof T.AxesHelper);assert.equal(marker.position.x,4);
 assert.equal(h.engine.begin(down,options),true);const radius=before.distanceTo(new T.Vector3(4,0,0));h.engine.move({...down,clientX:150});assert.ok(h.target.distanceTo(new T.Vector3(4,0,0))<1e-8);assert.ok(Math.abs(h.camera.position.distanceTo(h.target)-radius)<1e-8);assert.deepEqual(h.group.position,new T.Vector3());h.engine.finish(true);assert.deepEqual(h.camera.position,before);assert.deepEqual(h.parent.position,new T.Vector3(4,0,0));h.engine.dispose();
});
test('object orientation uses a displayed marker but commits the canonical pivot and leaves the push offset untouched',()=>{
 const h=setup(),options={...NAV_DEFAULTS,mode:'orient',actor:'object',target:'pointed'};assert.equal(h.engine.begin(down,options),true);const marker=h.scene.children.find(c=>c instanceof T.AxesHelper);assert.equal(marker.position.x,4);
 h.engine.move({...down,clientX:160});h.engine.finish();assert.ok(h.committed);assert.deepEqual(h.committed[2],{x:0,y:0,z:0});assert.deepEqual(h.parent.position,new T.Vector3(4,0,0));assert.deepEqual(h.group.position,new T.Vector3());h.engine.dispose();
});
test('a new push revision refreshes contextual pivot data even at the same pointer location',()=>{
 const h=setup(),options={...NAV_DEFAULTS,mode:'orbit',actor:'camera',pivot:'pointed'};h.engine.preview(options,{x:100,y:100});h.parent.position.x=7;h.revision();h.engine.preview(options,{x:100,y:100});const marker=h.scene.children.find(c=>c instanceof T.AxesHelper);assert.equal(marker.position.x,7);h.engine.dispose();
});
