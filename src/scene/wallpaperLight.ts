import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {DEFAULT_SCENE_VFX,SCENE_LIGHT_CONTROLS,type SceneVfx} from './vfx.ts';
import {bloomSize} from '../renderBudget.ts';

export const wallpaperLightUniformGLSL=SCENE_LIGHT_CONTROLS.map(({key})=>`uniform float ${key};`).join('\n');
export const wallpaperLightUniforms=()=>Object.fromEntries(SCENE_LIGHT_CONTROLS.map(({key,initial})=>[key,{value:Number(initial)}]));

/** Shared extraction in display space: neutral pixels emit only for a neutral target. */
export const wallpaperColourGLSL = `
  vec3 hsv(vec3 c){
    vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
    vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
    vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
    float d=q.x-min(q.w,q.y),e=1.e-10;
    return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);
  }
  vec3 rgbFromHSV(vec3 c){
    vec3 p=abs(fract(c.xxx+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);
    return c.z*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),c.y);
  }
  vec3 displayColour(vec3 c){
    return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));
  }
  vec3 linearColour(vec3 c){
    return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
  }
  float affinity(vec3 a){
    float distance=abs(a.x-lightHue);distance=min(distance,1.0-distance);
    float inner=min(lightHueInner,lightHueOuter)/360.0;
    float outer=max(max(lightHueInner,lightHueOuter)/360.0,inner+.00001);
    float chromatic=(1.0-smoothstep(inner,outer,distance))*smoothstep(.06,.22,a.y);
    float neutral=1.0-smoothstep(.03,.2,a.y);
    return mix(neutral,chromatic,smoothstep(.02,.15,lightSaturation))*smoothstep(.001,.025,a.z);
  }
  float emitter(vec3 a){return affinity(a)*pow(a.z,lightSourcePower);}
`;

/** Static spatial bloom, rebuilt only for a new image/colour, never on audio frames.
 * Keep it separate from additive world bloom: the wallpaper composites coloured
 * radiance with its own bounded colour treatment, behind all world/UI content. */
export function createWallpaperLight(renderer: THREE.WebGLRenderer) {
  const vertexShader='varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const extraction=new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{...wallpaperLightUniforms(),image:{value:null},lightHue:{value:0},lightSaturation:{value:1}},vertexShader,
    fragmentShader:`uniform sampler2D image;uniform float lightHue;uniform float lightSaturation;varying vec2 uv0;
      ${wallpaperLightUniformGLSL}
      ${wallpaperColourGLSL}
      void main(){float e=emitter(hsv(displayColour(texture2D(image,uv0).rgb)));gl_FragColor=vec4(e,e,e,1.0);}`,
  });
  const blur=new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{image:{value:null},stepUV:{value:new THREE.Vector2()}},vertexShader,
    fragmentShader:`uniform sampler2D image;uniform vec2 stepUV;varying vec2 uv0;
      void main(){vec3 c=texture2D(image,uv0).rgb*.227027;
        c+=(texture2D(image,uv0+stepUV*1.384615).rgb+texture2D(image,uv0-stepUV*1.384615).rgb)*.316216;
        c+=(texture2D(image,uv0+stepUV*3.230769).rgb+texture2D(image,uv0-stepUV*3.230769).rgb)*.070270;
        gl_FragColor=vec4(c,1.0);}`,
  });
  const quad=new FullScreenQuad(extraction);
  let targets:THREE.WebGLRenderTarget[]=[];
  let previous:THREE.Texture|null=null,previousKey='';
  const clear=()=>{for(const target of targets)target.dispose();targets=[];previous=null;previousKey='';extraction.uniforms.image.value=null;blur.uniforms.image.value=null;};
  return {
    prepare(image:THREE.Texture,hue:number,saturation:number,tuning:SceneVfx=DEFAULT_SCENE_VFX){
      const key=[hue,saturation,tuning.lightHueInner,tuning.lightHueOuter,tuning.lightSourcePower,tuning.lightNearRadius,tuning.lightFarRadius].join('/');
      if(previous===image&&previousKey===key&&targets.length)return {near:targets[2].texture,far:targets[3].texture};
      const source=image.image as {width:number;height:number};
      const {width,height}=bloomSize(source.width,source.height);
      if(!targets.length)targets=Array.from({length:4},()=>new THREE.WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false}));
      for(const target of targets)target.setSize(width,height);
      const savedTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),xr=renderer.xr.enabled;
      previous=null;previousKey='';
      try{
        renderer.xr.enabled=false;renderer.setScissorTest(false);
        extraction.uniforms.image.value=image;extraction.uniforms.lightHue.value=hue;extraction.uniforms.lightSaturation.value=saturation;
        for(const {key} of SCENE_LIGHT_CONTROLS)extraction.uniforms[key].value=tuning[key];
        quad.material=extraction;renderer.setRenderTarget(targets[0]);quad.render(renderer);
        quad.material=blur;
        const pass=(input:THREE.WebGLRenderTarget,output:THREE.WebGLRenderTarget,x:number,y:number)=>{
          blur.uniforms.image.value=input.texture;blur.uniforms.stepUV.value.set(x,y);
          renderer.setRenderTarget(output);quad.render(renderer);
        };
        // Two image-relative radii; no readback or repeated blur during playback.
        const radius=Math.max(width,height);
        pass(targets[0],targets[1],tuning.lightNearRadius/100*radius/width,0);pass(targets[1],targets[2],0,tuning.lightNearRadius/100*radius/height);
        pass(targets[2],targets[1],tuning.lightFarRadius/100*radius/width,0);pass(targets[1],targets[3],0,tuning.lightFarRadius/100*radius/height);
        previous=image;previousKey=key;
        return {near:targets[2].texture,far:targets[3].texture};
      }finally{
        renderer.xr.enabled=xr;renderer.setRenderTarget(savedTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
      }
    },
    clear,
    dispose(){clear();extraction.dispose();blur.dispose();quad.dispose();},
  };
}
