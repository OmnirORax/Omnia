import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {nodeCenter,nodeEdge} from '../src/world/nodeBoundary.ts';
import {createContentContour} from '../src/world/contentContour.ts';
const unit=()=>({body:new T.Mesh(new T.SphereGeometry(.5),new T.MeshBasicMaterial()),contour:createContentContour()});
test('sphere binders terminate at surfaces, including scaled nodes',()=>{const a=unit(),b=unit();b.body.position.x=3;a.body.scale.setScalar(2);const ac=nodeCenter(a),bc=nodeCenter(b);assert.ok(Math.abs(nodeEdge(a,bc).x-1)<1e-5);assert.ok(Math.abs(nodeEdge(b,ac).x-2.5)<1e-5);});
test('viewed content uses its visible center and convex edge rather than its node anchor',()=>{const v=unit();v.contour.update([{x:2,y:-1},{x:4,y:-1},{x:4,y:1},{x:2,y:1}],1);const center=nodeCenter(v);assert.ok(Math.abs(center.x-3)<1e-5);const edge=nodeEdge(v,new T.Vector3(10,0,0));assert.ok(edge.x>4&&edge.x<4.2);assert.ok(Math.abs(edge.y)<1e-5);});
