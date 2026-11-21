import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAxisView} from '../src/world/axisView.ts';
import {DEFAULT_ORIGIN_DIRECTIONS} from '../src/core/originDirections.ts';
function element(){return {style:{},append(){},setAttribute(){},remove(){},getContext:()=>({}),getBoundingClientRect:()=>({height:600})};}
globalThis.document={createElement:element,createTextNode:()=>({nodeValue:''})};
test('only the current origin is rendered and pickable; switching disposes the previous marker',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.1,100);camera.position.z=10;camera.updateMatrixWorld();
 const view=createAxisView(scene,element(),camera);
 const frame=(id,x)=>({id,origin:[x,0,0],ends:[],members:[],x:[1,0,0],y:[0,1,0],z:[0,0,1],directions:{...DEFAULT_ORIGIN_DIRECTIONS,halves:1}});
 const world={axes:[frame('old',0),frame('current',3)],activeAxis:'current'},before=structuredClone(world.axes);
 view.update(world,1);
 const group=scene.children.find(child=>child instanceof T.Group);
 assert.deepEqual(group.children.map(child=>child.userData.axis),['current']);
 assert.ok(view.picks.length>0);assert.ok(view.picks.every(child=>child.userData.axis==='current'));
 let disposed=0;group.children[0].children[0].geometry.addEventListener('dispose',()=>disposed++);
 world.activeAxis='old';view.update(world,1);
 assert.equal(disposed,1);assert.deepEqual(group.children.map(child=>child.userData.axis),['old']);
 assert.ok(view.picks.every(child=>child.userData.axis==='old'));
 assert.deepEqual(world.axes,before);
 view.dispose();assert.equal(scene.children.length,0);
});

test('hide-all removes the origin from rendering and picking, including after marker rebuilds',()=>{const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.1,100);camera.position.z=10;camera.updateMatrixWorld();const outputs=[],host={...element(),append(...items){outputs.push(...items);}},view=createAxisView(scene,host,camera),frame={id:'origin',origin:[0,0,0],ends:[],members:[],x:[1,0,0],y:[0,1,0],z:[0,0,1]},world={axes:[frame],activeAxis:'origin'};view.update(world,1);const group=scene.children.find(child=>child instanceof T.Group);assert.ok(view.picks.length);view.setVisible(false);view.coordinates(world,frame,[1,1,0],{x:10,y:10});view.brushCoordinates(world,frame,[[1,1,0]],1,camera,true);view.preview([0,0,0],[1,1,0]);assert.ok(outputs.every(output=>output.hidden));assert.ok(scene.children.filter(child=>child instanceof T.Line).every(child=>!child.visible));assert.equal(group.visible,false);assert.equal(view.picks.length,0);view.update({...world,axes:[{...frame,origin:[1,0,0]}]},1);assert.equal(group.visible,false);assert.equal(view.picks.length,0);view.setVisible(true);assert.equal(group.visible,true);assert.ok(view.picks.length);view.dispose();});
