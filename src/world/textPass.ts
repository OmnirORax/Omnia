import {bindTextWallpaper} from '../textureGlow.ts';
import {mergeVisibleTextBounds,visibleTextCenter,type ScreenTextBounds} from '../text/visibleTextCenter.ts';
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
export function bindWorldText(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){
 renderer.getDrawingBufferSize(uniforms.worldTextViewport.value);
 if(visibleTextCenter.enabled){
  let visible:ScreenTextBounds|undefined;
  const point=new T.Vector3();
  scene.traverseVisible(object=>{
   const label=object.userData.label;
   if(!object.layers.isEnabled(WORLD_TEXT_LAYER)||typeof label!=='string'||!label.trim())return;
   let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   for(let x=-.5;x<=.5;x++)for(let y=-.5;y<=.5;y++){
    point.set(x,y,0).applyMatrix4(object.matrixWorld).project(camera);
    if(point.z< -1||point.z>1)continue;
    const px=(1+point.x)/2,py=(1-point.y)/2;
    left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
   }
   visible=mergeVisibleTextBounds(visible,{left,top,right,bottom});
  });
  visibleTextCenter.updateWorld(visible);
 }
 bindTextWallpaper(uniforms.worldTextViewport.value.x,uniforms.worldTextViewport.value.y);
}
/** Does not re-render graph geometry or allocate a full-resolution offscreen target. */
export function renderWorldText(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,depth:T.DepthTexture){
 const mask=camera.layers.mask,background=scene.background,autoClear=renderer.autoClear;
 try{uniforms.worldTextDepth.value=depth;bindWorldText(renderer,scene,camera);uniforms.worldTextDepthEnabled.value=1;camera.layers.set(WORLD_TEXT_LAYER);scene.background=null;renderer.autoClear=false;renderer.setRenderTarget(null);renderer.clearDepth();renderer.render(scene,camera);}
 finally{camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;uniforms.worldTextDepthEnabled.value=0;uniforms.worldTextDepth.value=null;}
}
