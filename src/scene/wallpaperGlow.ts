import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {PULSE_COLOUR_GLSL,type FlareField} from './pulse.ts';
import type {SceneVfx} from './vfx.ts';

const vertex='varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
/** Wallpaper-only emission; the native base image never passes through this cache. */
export function createWallpaperGlow(renderer:THREE.WebGLRenderer){
 const source=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});

 const pyramid=Array.from({length:5},()=>({a:new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}),b:new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false})}));
 const output=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 const extract=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,defines:{PULSE_ALL_COLORS:0},
  uniforms:{image:{value:null},pulseTintHigh:{value:new THREE.Vector3()},pulseOmniTint:{value:new THREE.Vector3()}},vertexShader:vertex,
  fragmentShader:`varying vec2 uv0;uniform sampler2D image;uniform vec3 pulseTintHigh;${PULSE_COLOUR_GLSL}
   void main(){
    vec3 original=texture2D(image,uv0).rgb,visible=displayColour(original);
    vec3 broad=texture2D(image,uv0,4.0).rgb;
    float detail=max(0.0,dot(original-broad,vec3(.2126,.7152,.0722)));
    float seed=smoothstep(.005,.12,detail);
    seed*=smoothstep(.35,.9,max(visible.r,max(visible.g,visible.b)));
    #if PULSE_ALL_COLORS
    vec3 high=omniHighTint(visible,pulseOmniTint);
    #else
    vec3 high=pulseTintHigh;
    #endif
    gl_FragColor=vec4(linearColour(visible*high)*seed,1.0);
   }`});
 const blur=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:source.texture},delta:{value:new THREE.Vector2()}},vertexShader:vertex,
  fragmentShader:`varying vec2 uv0;uniform sampler2D image;uniform vec2 delta;void main(){gl_FragColor=texture2D(image,uv0)*.227027027+
   (texture2D(image,uv0+delta*1.384615385)+texture2D(image,uv0-delta*1.384615385))*.316216216+
   (texture2D(image,uv0+delta*3.230769231)+texture2D(image,uv0-delta*3.230769231))*.070270270;}`});
 const phases=Array.from({length:8},()=>new THREE.Vector2());
 const spread=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{level0:{value:source.texture},...Object.fromEntries(pyramid.map((p,i)=>[`level${i+1}`,{value:p.b.texture}])),reach:{value:1},strength:{value:1},phases:{value:phases}},vertexShader:vertex,
  fragmentShader:`varying vec2 uv0;uniform sampler2D level0,level1,level2,level3,level4,level5;uniform float reach,strength;uniform vec2 phases[8];
   vec3 field(float lod){
    if(lod<1.0)return mix(texture2D(level0,uv0).rgb,texture2D(level1,uv0).rgb,lod);
    if(lod<2.0)return mix(texture2D(level1,uv0).rgb,texture2D(level2,uv0).rgb,lod-1.0);
    if(lod<3.0)return mix(texture2D(level2,uv0).rgb,texture2D(level3,uv0).rgb,lod-2.0);
    if(lod<4.0)return mix(texture2D(level3,uv0).rgb,texture2D(level4,uv0).rgb,lod-3.0);
    return mix(texture2D(level4,uv0).rgb,texture2D(level5,uv0).rgb,lod-4.0);
   }
   void main(){
    vec3 emission=vec3(0.0);
    for(int i=0;i<8;i++)if(phases[i].y>.00001){
     float radius=reach*phases[i].x,lod=clamp(log2(max(1.0,radius)/6.4)+1.0,0.0,5.0);
     // Reject the broader low-frequency field: dense highlights must not turn
     // the whole image (including silhouettes) into a coloured veil.
     vec3 local=max(vec3(0.0),field(lod)-field(min(5.0,lod+1.5)));
     emission=max(emission,local*phases[i].y);
    }
    gl_FragColor=vec4(emission*strength,1.0);
   }`});
 const sourceQuad=new FullScreenQuad(extract),blurQuad=new FullScreenQuad(blur),spreadQuad=new FullScreenQuad(spread);
 let image:THREE.Texture|null=null,dirty=true,failed=false,key='',edge=1;
 const restored=()=>{dirty=true;failed=false;};renderer.domElement?.addEventListener('webglcontextrestored',restored);
 const color=(hex:string)=>{const c=new THREE.Color(hex).getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace);return new THREE.Vector3(c.r,c.g,c.b);};
 return {
  texture:output.texture,
  setImage(next:THREE.Texture|null){
   image=next;extract.uniforms.image.value=next;dirty=true;failed=false;
   if(!next)return;
   const size=next.image as {width:number;height:number};
   const width=Math.max(1,size.width),height=Math.max(1,size.height),ratio=Math.min(1,512/Math.max(width,height));
   const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));edge=Math.max(w,h);
   source.setSize(w,h);output.setSize(w,h);pyramid.forEach((p,i)=>{const div=Math.pow(2,i+1);p.a.setSize(Math.max(1,Math.round(w/div)),Math.max(1,Math.round(h/div)));p.b.setSize(p.a.width,p.a.height);});
  },
  configure(settings:SceneVfx){
   const next=`${settings.pulseColorMode}:${settings.pulseTintHigh}:${settings.pulseOmniTint}`;
   if(next!==key){key=next;dirty=true;failed=false;const all=Number(settings.pulseColorMode==='all');
    if(extract.defines.PULSE_ALL_COLORS!==all){extract.defines.PULSE_ALL_COLORS=all;extract.needsUpdate=true;}
    extract.uniforms.pulseTintHigh.value.copy(color(settings.pulseTintHigh));extract.uniforms.pulseOmniTint.value.copy(color(settings.pulseOmniTint));}
   spread.uniforms.reach.value=edge*settings.pulseGlowReach/100;spread.uniforms.strength.value=settings.pulseGlowStrength;
  },
  render(fields:readonly FlareField[],enabled:boolean){
   if(failed||!image||!enabled||!spread.uniforms.strength.value||!spread.uniforms.reach.value||!fields.some(f=>f.energy>.00001))return false;
   // Existing graph bloom also needs HDR targets. Mocks/unsupported fallback keep core tint only.
   if(typeof renderer.getRenderTarget!=='function'||!renderer.extensions?.has('EXT_color_buffer_float'))return false;
   const previous=renderer.getRenderTarget();
   try{
    if(dirty){
     renderer.setRenderTarget(source);sourceQuad.render(renderer);let previous=source.texture;
     for(const level of pyramid){
      blur.uniforms.image.value=previous;blur.uniforms.delta.value.set(1/level.a.width,0);renderer.setRenderTarget(level.a);blurQuad.render(renderer);
      blur.uniforms.image.value=level.a.texture;blur.uniforms.delta.value.set(0,1/level.a.height);renderer.setRenderTarget(level.b);blurQuad.render(renderer);previous=level.b.texture;
     }
     dirty=false;
    }
    for(let i=0;i<phases.length;i++)phases[i].set(fields[i]?.reach??0,fields[i]?.energy??0);
    renderer.setRenderTarget(output);spreadQuad.render(renderer);return true;
   }catch{failed=true;return false;}finally{renderer.setRenderTarget(previous);}
  },
  dispose(){renderer.domElement?.removeEventListener('webglcontextrestored',restored);sourceQuad.dispose();blurQuad.dispose();spreadQuad.dispose();extract.dispose();blur.dispose();spread.dispose();source.dispose();for(const p of pyramid){p.a.dispose();p.b.dispose();}output.dispose();},
 };
}
