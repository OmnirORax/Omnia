import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {pickAxisSegment} from '../src/world/axisHit.ts';
const rect={left:100,top:50,width:400,height:400};
function camera(zoom=1){const c=new T.OrthographicCamera(-1,1,1,-1,.1,20);c.position.z=5;c.zoom=zoom;c.updateProjectionMatrix();c.updateMatrixWorld();return c;}
function line(axis,a,b){const l=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(...a),new T.Vector3(...b)]));l.userData={axis:'frame',axisIndex:axis};return l;}
test('axis picking chooses the closest visible segment rather than the nearest axis in depth',()=>{
 const x=line(0,[-.18,0,0],[.18,0,0]),y=line(1,[0,-.18,0],[0,.18,0]),z=line(2,[0,0,-.18],[0,0,.18]);
 assert.deepEqual(pickAxisSegment({x:302,y:220},[x,z,y],camera(),rect),{axis:'frame',axisIndex:1});
 assert.equal(pickAxisSegment({x:315,y:235},[x,y,z],camera(),rect),undefined);
 y.visible=false;assert.equal(pickAxisSegment({x:302,y:220},[x,y,z],camera(),rect),undefined);
});
test('axis click tolerance remains six pixels across zoom levels and includes segment endpoints',()=>{
 const x=line(0,[-.18,0,0],[.18,0,0]);
 for(const zoom of [.5,1,2]){const c=camera(zoom);assert.ok(pickAxisSegment({x:310,y:255},[x],c,rect));assert.equal(pickAxisSegment({x:310,y:257},[x],c,rect),undefined);assert.ok(pickAxisSegment({x:300+36*zoom+3,y:250},[x],c,rect));}
});
