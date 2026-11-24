import * as T from 'three';
export const WORLD_TEXT_LAYER=2;
const uniforms={worldTextDepth:{value:null as T.DepthTexture|null},worldTextViewport:{value:new T.Vector2(1,1)},worldTextDepthEnabled:{value:0}};
/** Text is composited directly at output resolution, with the graph's original depth. */
export function nativeTextMaterial(material:T.MeshBasicMaterial){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{before.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.fragmentShader='uniform sampler2D worldTextDepth; uniform vec2 worldTextViewport; uniform float worldTextDepthEnabled;\n'+shader.fragmentShader.replace('#include <logdepthbuf_fragment>',`#include <logdepthbuf_fragment>
 if(worldTextDepthEnabled>.5){
  float textDepth=gl_FragCoord.z;
  #if defined(USE_LOGARITHMIC_DEPTH_BUFFER)
  textDepth=vIsPerspective==0.0?gl_FragCoord.z:log2(vFragDepth)*logDepthBufFC*.5;
  #endif
  float graphDepth=texture2D(worldTextDepth,gl_FragCoord.xy/worldTextViewport).r;
  if(textDepth>graphDepth+0.000002)discard;
 }
 `);};material.customProgramCacheKey=()=>key()+'.native-text.v1';
}
export function withoutWorldText<Result>(camera:T.Camera,render:()=>Result):Result{const mask=camera.layers.mask;camera.layers.disable(WORLD_TEXT_LAYER);try{return render();}finally{camera.layers.mask=mask;}}
/** Does not re-render graph geometry or allocate a full-resolution offscreen target. */
export function renderWorldText(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,depth:T.DepthTexture){
 const mask=camera.layers.mask,background=scene.background,autoClear=renderer.autoClear;
 try{uniforms.worldTextDepth.value=depth;renderer.getDrawingBufferSize(uniforms.worldTextViewport.value);uniforms.worldTextDepthEnabled.value=1;camera.layers.set(WORLD_TEXT_LAYER);scene.background=null;renderer.autoClear=false;renderer.setRenderTarget(null);renderer.clearDepth();renderer.render(scene,camera);}
 finally{camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;uniforms.worldTextDepthEnabled.value=0;uniforms.worldTextDepth.value=null;}
}
