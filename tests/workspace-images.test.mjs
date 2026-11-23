import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {encodeBytes} from '../src/core/transfer.ts';
import {canonicalWorkspaceImages,prepareWorkspaceImages} from '../src/core/workspaceImages.ts';
test('cloud backup normalization inherits native image identities and coalesces legacy aliases without changing the source',async()=>{
 const previous=globalThis.createImageBitmap;let closed=0;
 globalThis.createImageBitmap=async()=>({width:1,height:1,close(){closed++;}});
 try{
  const bytes=new Uint8Array(33);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);new DataView(bytes.buffer).setUint32(16,1);new DataView(bytes.buffer).setUint32(20,1);
  const world=emptyWorld();world.scene.image='alias-a';addStructure(world,[0,0,0],1).scene='alias-b';
  const file={format:'omnium-v2-workspace',version:1,world,scenes:['alias-a','alias-b'].map(id=>({id,name:'one.png',type:'image/png',data:encodeBytes(bytes)}))};
  const result=await canonicalWorkspaceImages(file);assert.equal(result.scenes.length,1);assert.match(result.scenes[0].id,/^sha256:/);assert.equal(result.world.scene.image,result.scenes[0].id);assert.equal(result.world.nodes[0].scene,result.scenes[0].id);assert.equal(file.world.scene.image,'alias-a');assert.equal(file.scenes.length,2);assert.equal(closed,2);const imported=await prepareWorkspaceImages(file);assert.deepEqual(imported.file,result);assert.equal(imported.prepared.length,1);assert.equal(imported.prepared[0].id,result.scenes[0].id);assert.equal(imported.prepared[0].blob.size,bytes.length);
 }finally{globalThis.createImageBitmap=previous;}
});
