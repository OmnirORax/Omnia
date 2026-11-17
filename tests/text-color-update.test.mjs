import test from 'node:test';
import assert from 'node:assert/strict';
import {visualObject,disposeVisual} from '../src/visualScene.ts';
import {label,textSprite,updateLabelPaint,labelGeometryKey,disposeLabel} from '../src/world/labels.ts';

// Instrument canvas work directly: appearance scrubs must never rasterize/upload.
const work={draw:0,read:0,write:0,canvas:0};
let finishFont;
globalThis.document={
 fonts:{load:()=>new Promise(resolve=>{finishFont=resolve;})},
 createElement(kind){
  assert.equal(kind,'canvas');work.canvas++;
  const canvas={width:0,height:0};
  const context={
   measureText:text=>({width:text.length*20}),clearRect(){},
   fillText(){work.draw++;},
   getImageData(){work.read++;return {data:new Uint8ClampedArray(canvas.width*canvas.height*4)};},
   putImageData(){work.write++;},beginPath(){},roundRect(){},fill(){},stroke(){},fillRect(){},
  };
  canvas.getContext=()=>context;return canvas;
 },
};
const snapshot=()=>({...work});

test('hundreds of glowing labels scrub color without canvas work, texture uploads or object replacement',()=>{
 const labels=Array.from({length:200},(_,i)=>label(`Node ${i}`,{glow:.8,color:'#ffffff'}));
 const textures=labels.map(mesh=>({map:mesh.material.map,version:mesh.material.map.version,geometry:mesh.geometry}));
 const before=snapshot();
 for(let step=0;step<30;step++)for(const mesh of labels)updateLabelPaint(mesh,{color:step%2?'#ff0000':'#0000ff',glow:.8,glowColor:step%2?'#00ff00':'#ffffff',translucency:step/40});
 assert.deepEqual(snapshot(),before);
 labels.forEach((mesh,i)=>{
  assert.equal(mesh.material.map,textures[i].map);assert.equal(mesh.material.map.version,textures[i].version);
  assert.equal(mesh.geometry,textures[i].geometry);assert.equal(mesh.material.color.getHexString(),'ff0000');
  assert.ok(mesh.material.opacity<1);disposeLabel(mesh);
 });
});

test('geometry revision excludes paint but preserves font invalidation',()=>{
 const key=labelGeometryKey({font:'serif',color:'#ffffff',glow:1});
 assert.equal(labelGeometryKey({font:'serif',color:'#ff0000',glow:0,translucency:1}),key);
 assert.notEqual(labelGeometryKey({font:'mono'}),key);
 assert.notEqual(labelGeometryKey({font:'serif'},1),key);
});

test('glow changes still rebuild packed coverage once; subsequent color changes do not',()=>{
 const mesh=label('Glow',{glow:0});const before=snapshot(),version=mesh.material.map.version;
 updateLabelPaint(mesh,{glow:.5,color:'#ff0000'});
 assert.ok(work.read>before.read);assert.ok(mesh.material.map.version>version);
 const after=snapshot();updateLabelPaint(mesh,{glow:.5,color:'#00ff00'});assert.deepEqual(snapshot(),after);
 disposeLabel(mesh);
});

test('surface-backed text retains canvas color painting',()=>{
 const mesh=textSprite('Panel','#ffffff');const before=snapshot();
 mesh.userData.setTextStyle('#ff0000','#00ff00',0);
 assert.ok(work.draw>before.draw);mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();
});

test('late font completion preserves latest color and subsequent uniform-only updates',async()=>{
 const mesh=label('Font',{font:'electric',color:'#ffffff',glow:.5});
 updateLabelPaint(mesh,{font:'electric',color:'#ff0000',glow:.5,translucency:.4});
 finishFont([]);await Promise.resolve();
 assert.equal(mesh.material.color.getHexString(),'ff0000');assert.ok(mesh.material.opacity<1);
 const before=snapshot();updateLabelPaint(mesh,{font:'electric',color:'#00ff00',glow:.5});
 assert.equal(mesh.material.color.getHexString(),'00ff00');assert.deepEqual(snapshot(),before);
 disposeLabel(mesh);
});

test('character glyphs inherit the same color-only update path',()=>{
 const group=visualObject({character:'◈'},[],text=>label(text,{glow:.5}),()=>{}, {textColor:'#ffffff',textGlow:.5});
 const mesh=group.children[0],map=mesh.material.map,version=map.version,before=snapshot();
 group.userData.setAppearance({textColor:'#ff0000',textGlow:.5,opacity:.7});
 assert.equal(group.children[0],mesh);assert.equal(mesh.material.map,map);assert.equal(map.version,version);
 assert.equal(mesh.material.color.getHexString(),'ff0000');assert.equal(mesh.material.opacity,.7);
 assert.deepEqual(snapshot(),before);disposeVisual(group);
});

test('independent text halo color updates the shader without redrawing coverage or recoloring clean ink',()=>{
 const mesh=label('Ink',{color:'#ff0000',glow:.5}),map=mesh.material.map,before=snapshot(),shader={uniforms:{},vertexShader:'',fragmentShader:'#include <map_fragment>'};
 mesh.material.onBeforeCompile(shader,{});
 updateLabelPaint(mesh,{color:'#ff0000',glow:.5,glowColor:'#0000ff'});
 assert.equal(shader.uniforms.glowInkColor.value.getHexString(),'0000ff');assert.equal(mesh.material.color.getHexString(),'ff0000');
 assert.equal(mesh.material.map,map);assert.deepEqual(snapshot(),before);
 updateLabelPaint(mesh,{color:'#ff0000',glow:.5,glowColor:'#00ff00'});assert.equal(shader.uniforms.glowInkColor.value.getHexString(),'00ff00');
 disposeLabel(mesh);
});
