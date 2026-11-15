import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {startsConnector,connectorDragged} from '../src/world/connectorGesture.ts';
import {navigateCamera} from '../src/navigation/model.ts';
import {NAV_DEFAULTS} from '../src/navigation/options.ts';
import {connectNodes} from '../src/core/nodeOperations.ts';
import {emptyWorld,addStructure,locate,validateWorld} from '../src/core/model.ts';
test('Shift-drag from a node takes ownership before camera routing for either mouse button',()=>{
 for(const button of [0,2])assert.equal(startsConnector({button,shiftKey:true},true,false),true);
 for(const [event,node,picking]of [[{button:0,shiftKey:false},true,false],[{button:2,shiftKey:true},false,false],[{button:0,shiftKey:true},true,true],[{button:0,shiftKey:true,ctrlKey:true},true,false]])assert.equal(startsConnector(event,node,picking),false);
 assert.equal(connectorDragged({x:0,y:0},{x:3,y:0}),false);assert.equal(connectorDragged({x:0,y:0},{x:4,y:0}),true);
});
test('an off-center orbit has no initial target or position jump and tiny deltas stay continuous',()=>{
 const pose={position:new T.Vector3(2,3,10),target:new T.Vector3(8,2,0),up:new T.Vector3(0,1,0)},pivot=new T.Vector3(-5,1,0),options={...NAV_DEFAULTS,mode:'orbit'};
 const zero=navigateCamera(pose,options,0,0,pivot);assert.ok(zero.position.distanceTo(pose.position)<1e-10);assert.ok(zero.target.distanceTo(pose.target)<1e-10);
 const tiny=navigateCamera(pose,options,.001,.001,pivot);assert.ok(tiny.position.distanceTo(pose.position)<.001);assert.ok(tiny.target.distanceTo(pose.target)<.001);
});
test('connector release creates a child on empty space or relates an existing node without relocating it',()=>{
 const world=emptyWorld(),source=addStructure(world,[0,0,0],1),target=addStructure(world,[8,0,0],2),before=structuredClone(target);
 connectNodes(world,source.origin,target.origin,[8,0,0]);assert.deepEqual(target,before);assert.equal(world.relationships.length,1);
 const child=locate(world,connectNodes(world,source.origin,undefined,[4,2,0]));assert.deepEqual(child.parent,source.origin);assert.deepEqual(child.position,[4,2,0]);assert.ok(source.parts.some(p=>JSON.stringify(p.origin)===JSON.stringify(child.origin)));validateWorld(world);
});
