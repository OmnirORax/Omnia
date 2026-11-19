import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOriginGizmo,disposeOriginGizmo} from '../src/world/originGizmo.ts';
import {DEFAULT_ORIGIN_DIRECTIONS,spatialDirectionSlots} from '../src/core/originDirections.ts';

test('only the active origin shows dial rays; inactive saved origins keep compact markers',()=>{
 const settings={...DEFAULT_ORIGIN_DIRECTIONS,halves:1,symmetry:true};
 const active=createOriginGizmo(1,true,[0,1,2],settings),inactive=createOriginGizmo(1,false,[0,1,2],settings);
 const rays=active.children.filter(child=>child instanceof T.LineSegments);
 assert.equal(rays.length,1);
 assert.equal(rays[0].geometry.getAttribute('position').count,2*spatialDirectionSlots(settings,[0,1,2]).length);
 assert.equal(inactive.children.some(child=>child instanceof T.LineSegments),false);
 assert.ok(inactive.children.some(child=>child.visible));
 disposeOriginGizmo(active);disposeOriginGizmo(inactive);
});

test('replacing origin gizmos releases each geometry and shared material, including dial rays',()=>{
 const scene=new T.Scene();
 for(let i=0;i<15;i++){
  const group=createOriginGizmo(1,true,[0,1],{...DEFAULT_ORIGIN_DIRECTIONS,halves:i%3});scene.add(group);
  const geometries=new Map(),materials=new Map();
  group.traverse(object=>{
   if(object.geometry&&!geometries.has(object.geometry)){const geometry=object.geometry;geometries.set(geometry,0);geometry.addEventListener('dispose',()=>geometries.set(geometry,geometries.get(geometry)+1));}
   for(const material of object.material?[object.material].flat():[])if(!materials.has(material)){materials.set(material,0);material.addEventListener('dispose',()=>materials.set(material,materials.get(material)+1));}
  });
  disposeOriginGizmo(group);
  assert.equal(scene.children.length,0);
  assert.ok([...geometries.values()].every(count=>count===1));
  assert.ok([...materials.values()].every(count=>count===1));
 }
});
