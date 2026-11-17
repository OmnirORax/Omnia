import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SceneGlow} from '../src/sceneGlow.ts';
import {sceneGlowDetail} from '../src/sceneGlowDetail.ts';

// Execute the production scalar GLSL policy with JS arithmetic. This verifies
// its actual expressions, without maintaining a second reference algorithm.
// It does not compile a GPU program or establish visual acceptance.
function policy(name){
 const match=sceneGlowDetail.match(new RegExp(`float ${name}\\(([^)]*)\\)\\s*\\{([^}]*)\\}`));assert.ok(match);
 const args=match[1].split(',').map(p=>p.trim().split(/\s+/).at(-1));
 return new Function(...args,`const {min,max,abs}=Math;const smoothstep=(a,b,n)=>{const t=max(0,min(1,(n-a)/(b-a)));return t*t*(3-2*t);};${match[2].replace(/\bfloat\b/g,'let')}`);
}
const protect=policy('detailProtection'),limit=policy('detailIntensityLimit');
test('flat regions and wide edges keep the original glow, bright or dim',()=>{
 for(const level of [.01,.1,1,4]){
  assert.equal(protect(level,level,level,level,level),0);
  assert.equal(protect(level,0,level,level,level),0);
  assert.equal(protect(0,0,level,0,0),0);
 }
});
test('thin strokes and gaps increase protection smoothly as they shrink on screen',()=>{
 assert.equal(protect(1,0,0,1,1),1);assert.equal(protect(0,1,1,0,0),1);
 const values=[.5,.4,.3,.2,.1,0].map(neighbour=>protect(1,neighbour,neighbour,1,1));
 for(let i=1;i<values.length;i++)assert.ok(values[i]>=values[i-1]);
 assert.equal(values[0],0);assert.equal(values.at(-1),1);
 assert.equal(protect(.003,0,0,.003,.003),0);
});
test('final halo preserves detail at partial protection and leaves the outside glow unchanged',()=>{
 for(const strength of [.01,.1,1,10,100]){
  assert.equal(strength*limit(1,strength,0),strength);
  assert.equal(strength*limit(1,strength,1),0);
  for(const protection of [.1,.25,.5,.75,.99]){
   const halo=strength*limit(1,strength,protection),budget=.05*(1-protection)/protection;
   assert.ok(halo<=budget+1e-8);assert.ok(halo>=0);
  }
 }
});

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
  assert.equal(glow.mix.uniforms.base.value,read.texture);assert.equal(glow.mix.uniforms.narrowGlow.value,glow.bloom.renderTargetsVertical[0].texture);
  assert.equal(gpu.draws.length,9);assert.ok(gpu.draws.every(draw=>draw.target!==read));
  assert.ok(glow.target.width<=512);assert.equal(glow.mix.uniforms.texel.value.x,1/1920);
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
