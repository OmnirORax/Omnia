import test from 'node:test';
import assert from 'node:assert/strict';
import {visualObject,disposeVisual} from '../src/visualScene.ts';
import {label,textSprite,updateLabelPaint,labelGeometryKey,disposeLabel} from '../src/world/labels.ts';

// Instrument canvas work directly: appearance scrubs must never rasterize/upload.
const work={draw:0,read:0,write:0,canvas:0};
const blurSamples=[];
let finishFont;
globalThis.document={
 fonts:{load:()=>new Promise(resolve=>{finishFont=resolve;})},
 createElement(kind){
  assert.equal(kind,'canvas');work.canvas++;
  const canvas={width:0,height:0};
  const context={
   measureText:text=>({width:text.length*20}),clearRect(){},
   fillText(){work.draw++;blurSamples.push(this.shadowBlur);},
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
  assert.equal(mesh.material.opacity,1);disposeLabel(mesh);
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
 assert.equal(mesh.material.color.getHexString(),'ff0000');assert.equal(mesh.material.opacity,1);
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

test('retired text brightness cannot change existing ink or halo uniforms',()=>{
 const mesh=label('Brightness',{color:'#204060',glowColor:'#102030',glow:.5}),map=mesh.material.map,before=snapshot();
 const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <map_fragment>'};mesh.material.onBeforeCompile(shader,{});
 for(let i=0;i<20;i++)updateLabelPaint(mesh,{color:'#204060',glowColor:'#102030',glow:.5,brightness:.75});
 assert.equal(mesh.material.color.getHexString(),'204060');assert.equal(shader.uniforms.glowInkColor.value.getHexString(),'102030');
 assert.equal(mesh.userData.labelPaint.color,'#204060');assert.equal(mesh.material.map,map);assert.deepEqual(snapshot(),before);disposeLabel(mesh);
});

test('retired text opacity and translucency cannot fade ink or rebuild coverage',()=>{
 const mesh=label('Opacity',{color:'#ff0000',glow:1}),before=snapshot();
 updateLabelPaint(mesh,{color:'#ff0000',glow:1,opacity:.4,translucency:.25});assert.equal(mesh.material.opacity,1);assert.deepEqual(snapshot(),before);
 updateLabelPaint(mesh,{color:'#ff0000',glow:1,opacity:0});assert.equal(mesh.material.opacity,1);assert.deepEqual(snapshot(),before);disposeLabel(mesh);
});

test('text glow spread updates cached coverage while preserving geometry and color-only fast updates',()=>{
 const mesh=label('Spread',{glow:2,glowSpread:6}),geometry=mesh.geometry,material=mesh.material,texture=material.map;
 assert.ok(blurSamples.includes(6*1.6));blurSamples.length=0;const before=texture.version;
 updateLabelPaint(mesh,{glow:2,glowSpread:10});assert.ok(blurSamples.includes(10*1.6));assert.ok(texture.version>before);
 assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(mesh.material.map,texture);
 const after=snapshot();updateLabelPaint(mesh,{glow:2,glowSpread:10,color:'#123456'});assert.deepEqual(snapshot(),after);disposeLabel(mesh);
});

test('retired brightness switch cannot change cached label or character ink or trigger canvas work',()=>{
 const paint={color:'#204060',glowColor:'#102030',glow:1,brightness:.75,brightnessEnabled:false},mesh=label('Brightness',paint),before=snapshot();
 updateLabelPaint(mesh,{...paint,brightnessEnabled:true});assert.equal(mesh.material.color.getHexString(),'204060');assert.deepEqual(snapshot(),before);
 updateLabelPaint(mesh,paint);assert.equal(mesh.material.color.getHexString(),'204060');assert.deepEqual(snapshot(),before);disposeLabel(mesh);
 const asset={id:'glyph',kind:'text',text:'x'},object=visualObject({assetId:'glyph',character:'x'},[asset],value=>label(value),()=>{},{textPaint:{...paint,brightnessEnabled:true}});
 const ink=object.children.find(child=>child.userData.isLabel);assert.ok(ink);assert.equal(ink.material.color.getHexString(),'204060');
 const after=snapshot();object.userData.setAppearance({textPaint:paint});assert.equal(ink.material.color.getHexString(),'204060');assert.deepEqual(snapshot(),after);disposeVisual(object);
});

 test('font size updates scale reversibly without rerasterizing labels',()=>{
 const mesh=label('Size',{fontSize:12}),original=mesh.scale.clone(),texture=mesh.material.map,version=texture.version,before=snapshot();
 for(const fontSize of [24,18,18,6,12]){updateLabelPaint(mesh,{fontSize});assert.ok(mesh.scale.distanceTo(original.clone().multiplyScalar(fontSize/12))<1e-9);}
 assert.equal(mesh.material.map,texture);assert.equal(texture.version,version);assert.deepEqual(snapshot(),before);
 assert.equal(labelGeometryKey({fontSize:12}),labelGeometryKey({fontSize:24}));disposeLabel(mesh);
});

test('document and world adapters receive identical text and glow through the shared setter',async()=>{
 const {setDOMTextPaint}=await import('../src/ui/appearance.ts'),{imageColorCombo}=await import('../src/scene/colorCombo.ts');
 const combo=imageColorCombo(new Uint8ClampedArray([10,30,200,255,10,30,200,255,255,120,20,255,180,30,200,255]));
 const mesh=label('Shared setter'),doc={color:'',fontFamily:'',textShadow:''},shader={uniforms:{},fragmentShader:'#include <map_fragment>\n#include <logdepthbuf_fragment>'};mesh.material.onBeforeCompile(shader,{});
 try{for(const paint of [{color:combo.text,glowColor:combo.textGlow,glow:1.4,glowSpread:8},{color:'#22aa66',glow:1,glowSpread:3},{color:'#0044ff',glowColor:'#ff7700',glow:2,glowSpread:10},{}]){
  const assigned=setDOMTextPaint(doc,paint);updateLabelPaint(mesh,paint);
  assert.equal(mesh.material.color.getHexString(),doc.color.slice(1,7));assert.equal(shader.uniforms.glowInkColor.value.getHexString(),assigned.glowColor.slice(1));
  assert.equal(mesh.userData.labelPaint.glow,assigned.glow);assert.equal(mesh.userData.labelPaint.glowSpread,assigned.glowSpread);
  if(assigned.glow)assert.ok(doc.textShadow.includes(assigned.glowColor+'ff'));else assert.equal(doc.textShadow,'none');
 }}finally{disposeLabel(mesh);}
});

test('spatial palette changes update shared shader uniforms without text rasterization or texture uploads',()=>{
 const mesh=label('Gradient',{color:'#ffbfbf',glowColor:'#ff0000',glow:.5}),before=snapshot(),map=mesh.material.map,version=map.version;
 updateLabelPaint(mesh,{color:'#ffbfbf',glowColor:'#ff0000',glow:.5,palette:{mode:'text',colors:['#ff0000','#0000ff','#00ff00']}});
 const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <map_fragment>'};mesh.material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.textPaletteCount.value,3);assert.equal(shader.uniforms.textPaletteStops.value[1].x,2/3);assert.match(shader.fragmentShader,/paletteGlow\(vMapUv.x\)/);
 assert.equal(mesh.material.map,map);assert.equal(map.version,version);assert.deepEqual(snapshot(),before);
 updateLabelPaint(mesh,{color:'#ffbfbf',glow:.5,palette:{mode:'nodes',colors:['#ff0000','#0000ff']}});assert.equal(shader.uniforms.textPaletteCount.value,0);disposeLabel(mesh);
});
