import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {projectedBounds} from '../src/world/projectedBounds.ts';
test('scene editor anchor covers the visible target rather than its center',()=>{
 const camera=new T.PerspectiveCamera(60,1,.1,100);camera.position.z=5;camera.lookAt(0,0,0);
 const viewport={x:10,y:20,width:500,height:500},bounds=new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1)),result=projectedBounds(bounds,camera,viewport);
 assert.ok(result.x<260&&result.y<270&&result.width>200&&result.height>200);assert.equal(result.x+result.width/2,260);assert.equal(result.y+result.height/2,270);
 const behind=new T.Box3(new T.Vector3(-1,-1,8),new T.Vector3(1,1,9));assert.deepEqual(projectedBounds(behind,camera,viewport),{x:260,y:270,width:0,height:0});
});
