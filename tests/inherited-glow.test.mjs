import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {inheritedValue} from '../src/graph/inheritedValue.ts';
import {createContentContour} from '../src/world/contentContour.ts';
test('content view retains node glow through its shared ancestor, and local deltas override it',()=>{
 const node=new T.Group(),presentation=new T.Group(),body=new T.Mesh(),contour=createContentContour();node.add(body,presentation);presentation.add(contour.outline);node.userData.glowIntensity=.8;
 assert.equal(inheritedValue(body,'glowIntensity',0),.8);body.visible=false;contour.outline.visible=true;assert.equal(inheritedValue(contour.outline,'glowIntensity',0),.8);
 node.userData.glowIntensity=.3;assert.equal(inheritedValue(contour.outline,'glowIntensity',0),.3);contour.outline.userData.glowIntensity=0;assert.equal(inheritedValue(contour.outline,'glowIntensity',1),0);delete contour.outline.userData.glowIntensity;assert.equal(inheritedValue(contour.outline,'glowIntensity',0),.3);contour.dispose();body.geometry.dispose();body.material.dispose();
});
