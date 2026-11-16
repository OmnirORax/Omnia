import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {orientNodeContent} from '../src/world/nodeOrientation.ts';
test('content visibly inherits node rotation through repeated camera-facing render updates',()=>{
 const node=new T.Group(),content=new T.Group();node.add(content);const camera=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.4),turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);node.quaternion.copy(turn);
 for(let i=0;i<3;i++){orientNodeContent(content.quaternion,camera);node.updateMatrixWorld(true);const shown=content.getWorldQuaternion(new T.Quaternion());assert.ok(shown.angleTo(turn.clone().multiply(camera))<1e-7);assert.ok(shown.angleTo(camera)>.1);}
 node.quaternion.identity();orientNodeContent(content.quaternion,camera);node.updateMatrixWorld(true);assert.ok(content.getWorldQuaternion(new T.Quaternion()).angleTo(camera)<1e-7);
});
