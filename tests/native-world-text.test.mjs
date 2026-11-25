import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {WORLD_TEXT_LAYER,nativeTextMaterial,withoutWorldText,renderWorldText} from '../src/world/textPass.ts';
import {packedTextureGlow,updateTextureTextPalette} from '../src/textureGlow.ts';
import {wallpaperSampleGLSL} from '../src/scene/wallpaperSample.ts';
import {emptyWorld,addStructure} from '../src/core/model.ts';import {writePaint,readPaint,nodeTextPaint} from '../src/core/appearance.ts';
import {sceneOutputPixelRatio,budgetPixelRatio,RENDER_BUDGET} from '../src/renderBudget.ts';
test('native text pass uses output pixels, graph depth and restores renderer state after rendering or failure',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();scene.background=new T.Color('red');camera.layers.enable(WORLD_TEXT_LAYER);const mask=camera.layers.mask,background=scene.background,depth=new T.DepthTexture(),material=new T.MeshBasicMaterial();nativeTextMaterial(material);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});
 let draws=0;const renderer={autoClear:true,setRenderTarget:target=>assert.equal(target,null),clearDepth(){},getDrawingBufferSize:size=>size.set(3840,2160),render(s,c){draws++;assert.equal(s,scene);assert.equal(c.layers.mask,1<<WORLD_TEXT_LAYER);assert.equal(s.background,null);assert.equal(renderer.autoClear,false);assert.equal(shader.uniforms.worldTextDepth.value,depth);assert.deepEqual(shader.uniforms.worldTextViewport.value.toArray(),[3840,2160]);assert.equal(shader.uniforms.worldTextDepthEnabled.value,1);}};
 renderWorldText(renderer,scene,camera,depth);assert.equal(draws,1);assert.equal(camera.layers.mask,mask);assert.equal(scene.background,background);assert.equal(renderer.autoClear,true);assert.equal(shader.uniforms.worldTextDepthEnabled.value,0);
 renderer.render=()=>{throw Error('gpu failure');};assert.throws(()=>renderWorldText(renderer,scene,camera,depth));assert.equal(camera.layers.mask,mask);assert.equal(scene.background,background);assert.equal(shader.uniforms.worldTextDepthEnabled.value,0);depth.dispose();material.dispose();
});
test('Image pixels samples the shared static frame without live wallpaper uniforms',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),depth=new T.DepthTexture(),material=new T.MeshBasicMaterial();
 packedTextureGlow(material);
 const defaultKey=material.customProgramCacheKey();
 const palette={mode:'text',distribution:'pixels',ink:'pale',pixelSources:['#a15555','#3366bb'],colors:['#ff0000','#0000ff']};
 updateTextureTextPalette(material,palette);assert.notEqual(material.customProgramCacheKey(),defaultKey);
 const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});
 assert.ok(shader.fragmentShader.includes('vec2 imageUV=gl_FragCoord.xy/wallpaperViewport;'));
 assert.ok(!shader.fragmentShader.includes(wallpaperSampleGLSL));
 assert.equal(shader.uniforms.imagePixelFrameReady.value,0);
 assert.equal(shader.uniforms.textPaletteInk.value,.25);
 updateTextureTextPalette(material,{...palette,paleAmount:.5});assert.equal(shader.uniforms.textPaletteInk.value,.5);
 const frameUniform=shader.uniforms.imagePixelFrame;
 updateTextureTextPalette(material,{...palette,ink:'color'});assert.equal(shader.uniforms.textPaletteInk.value,1);
 assert.equal(shader.uniforms.imagePixelFrame,frameUniform);
 let draws=0;
 const renderer={autoClear:true,setRenderTarget(){},clearDepth(){},getDrawingBufferSize:size=>size.set(1280,720),render(){
  draws++;assert.deepEqual(shader.uniforms.wallpaperViewport.value.toArray(),[1280,720]);
 }};
 renderWorldText(renderer,scene,camera,depth);assert.equal(draws,1);
 updateTextureTextPalette(material,{mode:'text',distribution:'growing',colors:['#222222']});assert.equal(material.customProgramCacheKey(),defaultKey);
 material.dispose();depth.dispose();
});
test('budgeted graph pass excludes native labels and restores camera layers on failure',()=>{const camera=new T.PerspectiveCamera();camera.layers.enable(WORLD_TEXT_LAYER);const initial=camera.layers.mask;assert.throws(()=>withoutWorldText(camera,()=>{assert.equal(camera.layers.isEnabled(WORLD_TEXT_LAYER),false);assert.equal(camera.layers.isEnabled(0),true);throw Error('fail');}));assert.equal(camera.layers.mask,initial);});
test('native depth hook retains the existing coverage shader and logarithmic depth conversion',()=>{const material=new T.MeshBasicMaterial();packedTextureGlow(material);nativeTextMaterial(material);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});assert.ok(shader.fragmentShader.includes('float clean=coverage.r'));assert.ok(shader.fragmentShader.includes('USE_LOGARITHMIC_DEPTH_BUFFER'));assert.ok(shader.fragmentShader.includes('log2(vFragDepth)*logDepthBufFC*.5'));assert.ok(shader.fragmentShader.includes('texture2D(worldTextDepth'));assert.ok(shader.fragmentShader.includes('#include <colorspace_fragment>'));material.dispose();});
test('native text retains authored halo coverage at normal and minified viewing sizes',()=>{
 const material=new T.MeshBasicMaterial();packedTextureGlow(material);nativeTextMaterial(material);
 const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});
 try{
  // Evaluate the shader's actual halo expression. It must depend only on the
  // filtered texture coverage, without an additional projected-stroke cutoff.
  const expression=shader.fragmentShader.match(/float halo=([^;]+);/)?.[1];
  assert.ok(expression);
  const halo=Function('coverage','clean','max',`return ${expression};`);
  for(const [clean,combined] of [[0,.8],[.15,.4],[.03,.08],[0,0],[.8,.7]])
   assert.ok(Math.abs(halo({g:combined},clean,Math.max)-Math.max(0,combined-clean))<1e-9);
  assert.equal(shader.fragmentShader.includes('zoomGlowScale'),false);
 }finally{material.dispose();}
});
test('world label ink and authored glow match document paint even when its node glows',()=>{const world=emptyWorld(),node=addStructure(world,[0,0,0],1);writePaint(world,'text',[],{color:'#ff2200',glow:1,glowColor:'#7722ff'});node.glow=2;const doc=readPaint(world,'nodeText',node.origin),label=nodeTextPaint(world,node);assert.equal(label.color,doc.color);assert.equal(label.glow,doc.glow);assert.equal(label.glowColor,doc.glowColor);});
test('final text output stays native within its cap while the graph keeps its lower pixel budget',()=>{assert.equal(sceneOutputPixelRatio(1920,1080,2,true),2);assert.equal(sceneOutputPixelRatio(1920,1080,2,false),2);assert.ok(budgetPixelRatio(1920,1080,2,RENDER_BUDGET.scenePixels,RENDER_BUDGET.maxSceneDpr)<1);});
test('native text layer remains raycastable when enabled for world picking',()=>{const mesh=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial());mesh.layers.set(WORLD_TEXT_LAYER);mesh.updateMatrixWorld();const ray=new T.Raycaster(new T.Vector3(0,0,2),new T.Vector3(0,0,-1));ray.layers.enable(WORLD_TEXT_LAYER);assert.ok(ray.intersectObject(mesh).length);mesh.geometry.dispose();mesh.material.dispose();});
test('the actual coverage shader suppresses only black halo and preserves sharp black ink',()=>{
 const material=new T.MeshBasicMaterial();packedTextureGlow(material);const shader={uniforms:{},fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader,{});try{const expression=shader.fragmentShader.match(/halo\*=([^;]+);/)?.[1];assert.ok(expression);const emitted=Function('glow','step','max',`return ${expression};`),step=(edge,x)=>x>=edge?1:0;assert.equal(emitted({r:0,g:0,b:0},step,Math.max),0);assert.equal(emitted({r:1,g:0,b:0},step,Math.max),1);assert.equal(emitted({r:0,g:0,b:.1},step,Math.max),1);const clean=.8,halo=.4;assert.equal(clean+halo*emitted({r:0,g:0,b:0},step,Math.max),clean);}finally{material.dispose();}
});
