import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SceneGlow} from '../src/sceneGlow.ts';
import {glowScale,projectedGlowDetail,GLOW_DETAIL_PIXELS} from '../src/glowScale.ts';
import {declareGlowDetail} from '../src/materialCoverage.ts';
import {packGlowCoverage} from '../src/textureGlow.ts';
import {glyphFeatureSize,rememberGlyphFeature,glyphAssetFeature} from '../src/omnic/vectorPlan.ts';

function renderer(){
 const draws=[];let target;const color=new T.Color();
 return {draws,autoClear:true,getClearColor:c=>c.copy(color),getClearAlpha:()=>1,setClearColor:c=>color.set(c),setRenderTarget:t=>{target=t;},clear(){},render(scene){draws.push({target,scene});}};
}
test('shared glow renders only the two contributing scales and keeps the base separate',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),glow=new SceneGlow(scene,camera,4),read=new T.WebGLRenderTarget(100,100),write=read.clone(),gpu=renderer();
 try{
  glow.configure(.7,2);glow.setSize(1920,1080);glow.render(gpu,write,read,0);
  assert.equal(glow.bloom.nMips,2);assert.equal(glow.bloom.renderTargetsHorizontal.length,2);assert.equal(glow.bloom.renderTargetsVertical.length,2);
  assert.deepEqual(glow.bloom.compositeMaterial.uniforms.bloomFactors.value,[1,.24]);
  assert.equal(glow.mix.uniforms.base.value,read.texture);
  assert.equal(gpu.draws.length,9);assert.ok(gpu.draws.every(draw=>draw.target!==read));
  assert.ok(glow.target.width<=512);assert.equal(glow.outputHeight,1080);
  // Released levels must never be sampled by the composite.
  for(const id of [3,4,5])assert.ok(!new RegExp(`texture2D\\( blurTexture${id},`).test(glow.bloom.compositeMaterial.fragmentShader));
 }finally{glow.dispose();read.dispose();write.dispose();}
});
test('emission inheritance and material/background restoration survive a failed mask draw',()=>{
 const scene=new T.Scene(),parent=new T.Group(),mesh=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({color:'#ff0000'}));parent.userData.glowIntensity=.5;parent.add(mesh);scene.add(parent);
 const background=scene.background=new T.Color('#123456'),original=mesh.material,glow=new SceneGlow(scene,new T.PerspectiveCamera(),4),read=new T.WebGLRenderTarget(1,1),gpu=renderer();
 gpu.render=()=>{assert.notEqual(mesh.material,original);assert.equal(mesh.material.color.r,.5);throw Error('draw failed');};
 try{assert.throws(()=>glow.render(gpu,read,read,0),/draw failed/);assert.equal(mesh.material,original);assert.equal(scene.background,background);}
 finally{glow.dispose();read.dispose();mesh.geometry.dispose();original.dispose();}
});

test('glow decreases proportionally with detail size and reaches zero',()=>{
 assert.equal(glowScale(GLOW_DETAIL_PIXELS.full),1);assert.equal(glowScale(GLOW_DETAIL_PIXELS.off),0);
 assert.equal(glowScale(0),0);assert.equal(glowScale(100),1);
 assert.equal(glowScale((GLOW_DETAIL_PIXELS.off+GLOW_DETAIL_PIXELS.full)/2),.5);
 assert.equal(glowScale(NaN),0);
});
test('projected detail follows zoom, viewport resolution and object scale rather than distance from world origin',()=>{
 const world=new T.Matrix4().makeTranslation(100,50,-10),camera=new T.PerspectiveCamera(90,1,.1,10000);camera.position.set(100,50,0);camera.updateMatrixWorld();
 const measure=(matrix,height=100,perspective=true)=>projectedGlowDetail(1,matrix.elements,camera.matrixWorldInverse.elements,camera.projectionMatrix.elements[5],height,perspective);
 assert.ok(Math.abs(measure(world)-5)<1e-8);
 assert.ok(Math.abs(measure(new T.Matrix4().makeTranslation(100,50,-20))-2.5)<1e-8);
 assert.ok(Math.abs(measure(world,200)-10)<1e-8);
 const scaled=new T.Matrix4().compose(new T.Vector3(100,50,-10),new T.Quaternion(),new T.Vector3(2,2,2));assert.ok(Math.abs(measure(scaled)-10)<1e-8);
 assert.equal(measure(world,100,false),measure(new T.Matrix4().makeTranslation(100,50,-1000),100,false));
});
test('zoom fades the entire emission owner, keeps base materials intact and isolates shared source materials',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(90,1,.1,1000),geometry=new T.PlaneGeometry(),original=new T.MeshBasicMaterial({color:'white'});declareGlowDetail(original,1);
 const near=new T.Mesh(geometry,original),far=new T.Mesh(geometry,original);near.userData.glowIntensity=far.userData.glowIntensity=1;near.position.z=-10;far.position.z=-100;scene.add(near,far);camera.updateMatrixWorld();
 const glow=new SceneGlow(scene,camera,4),read=new T.WebGLRenderTarget(100,100),write=read.clone(),gpu=renderer(),samples=[];glow.setSize(100,100);
 const draw=gpu.render;gpu.render=object=>{if(object===scene)samples.push({near:near.material,far:far.material,n:near.material.color.r,f:far.material.color.r});draw(object);};
 try{
  scene.updateMatrixWorld(true);glow.render(gpu,write,read,0);assert.equal(samples[0].n,1);assert.equal(samples[0].f,0);assert.notEqual(samples[0].near,samples[0].far);
  near.position.z=-20;scene.updateMatrixWorld(true);glow.render(gpu,write,read,0);assert.ok(Math.abs(samples[1].n-.4)<1e-8);assert.equal(samples[1].near,samples[0].near);
  near.position.z=-40;scene.updateMatrixWorld(true);glow.render(gpu,write,read,0);assert.equal(samples[2].n,0);
  assert.equal(near.material,original);assert.equal(far.material,original);assert.equal(original.color.r,1);assert.equal(original.opacity,1);
 }finally{glow.dispose();read.dispose();write.dispose();geometry.dispose();original.dispose();}
});
test('fine visible content fades its broader owner glow; hidden content and other owners do not',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(90,1,.1,1000),parent=new T.Group(),geometry=new T.PlaneGeometry(),broad=new T.MeshBasicMaterial({color:'white'}),fine=broad.clone();declareGlowDetail(broad,1);declareGlowDetail(fine,.1);
 const edge=new T.Mesh(geometry,broad),ink=new T.Mesh(geometry,fine);parent.userData.glowIntensity=1;parent.position.z=-10;parent.add(edge,ink);scene.add(parent);scene.updateMatrixWorld(true);camera.updateMatrixWorld();
 const glow=new SceneGlow(scene,camera,4),read=new T.WebGLRenderTarget(100,100),gpu=renderer(),samples=[];glow.setSize(100,100);const draw=gpu.render;gpu.render=object=>{if(object===scene)samples.push(edge.material.color.r);draw(object);};
 try{glow.render(gpu,read,read,0);assert.equal(samples[0],0);ink.visible=false;glow.render(gpu,read,read,0);assert.equal(samples[1],1);}
 finally{glow.dispose();read.dispose();geometry.dispose();broad.dispose();fine.dispose();}
});
test('packed glow keeps clean antialiased ink separate from halo using the same texture',()=>{
 const clean=new Uint8ClampedArray([255,255,255,255,255,255,255,100,0,0,0,0]);
 const halo=new Uint8ClampedArray([255,255,255,255,255,255,255,180,255,255,255,40]);packGlowCoverage(clean,halo);
 for(let i=0;i<3;i++)assert.equal(halo[i*4],clean[i*4+3]);
 assert.deepEqual([halo[1],halo[5],halo[9]],[255,180,40]);assert.ok([halo[3],halo[7],halo[11]].every(n=>n===255));
 const same=new Uint8ClampedArray([1,2,3,100]);packGlowCoverage(same,same);assert.deepEqual([...same],[100,100,0,255]);
});
test('glyph detail capabilities survive raster fallback as well as native vectors',()=>{
 const plan={bounds:{x:0,y:0,width:100,height:100},nodes:[{kind:'line',opacity:1,thickness:2,radius:0,fill:false},{kind:'ring',opacity:1,thickness:4,radius:10,fill:false}]};
 assert.equal(glyphFeatureSize(plan),.02);const asset={id:'test',kind:'image'};rememberGlyphFeature(asset,plan);assert.equal(glyphAssetFeature(asset),.02);
});
