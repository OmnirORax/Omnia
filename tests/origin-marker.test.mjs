import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOriginSphere,originSegment,ORIGIN_RADIUS} from '../src/world/originMarker.ts';
test('origin axes stay within the mini sphere at arbitrary scale and orientation',()=>{for(const scale of [.2,1,8]){const marker=createOriginSphere(scale,true),center=new T.Vector3(10,-3,5),rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,1,0).normalize(),.8);assert.equal(marker.userData.originMarker,true);assert.ok(ORIGIN_RADIUS<.5);for(const axis of [[1,0,0],[0,1,0],[0,0,1]])for(const p of originSegment(center,new T.Vector3(...axis).applyQuaternion(rotation),scale))assert.ok(Math.abs(p.distanceTo(center)-marker.geometry.parameters.radius*marker.scale.x)<1e-7);marker.geometry.dispose();marker.material.dispose();}});
