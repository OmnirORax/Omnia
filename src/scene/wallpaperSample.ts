import * as THREE from 'three';
import {createSceneCorrection,sceneCorrectionGLSL,sceneCorrectionUniforms} from './normalizationShader.ts';
import {REFERENCE_PULSE_GLSL,SCENE_COLOR_SPACE_GLSL} from './pulse.ts';
import {normalizeSceneVfx,WAVE_CONTROLS} from './vfx.ts';

export function createWallpaperSampling(initial=normalizeSceneVfx(undefined)){
 const correction=createSceneCorrection();
 const tint=(hex:string)=>{
  const {r,g,b}=new THREE.Color(hex).getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace);
  return new THREE.Vector3(r,g,b);
 };
 const uniforms={
  ...sceneCorrectionUniforms(correction),image:{value:null as THREE.Texture|null},imageAspect:{value:1},viewportAspect:{value:1},
  imageTint:{value:tint(initial.imageTint)},pulseTintLow:{value:tint(initial.pulseTintLow)},pulseTintHigh:{value:tint(initial.pulseTintHigh)},
  imageTintEnabled:{value:Number(initial.imageTintEnabled)},time:{value:0},bounce:{value:1},light:{value:0},
  ...Object.fromEntries(WAVE_CONTROLS.map(({key,initial})=>[key,{value:initial}])),waves:{value:1},waveAudio:{value:1},
  feedbackColor:{value:new THREE.Color()},feedbackStrength:{value:0},
 };
 return {correction,uniforms};
}
export type WallpaperSampleUniforms=ReturnType<typeof createWallpaperSampling>['uniforms'];

/** The wallpaper and text use one screen-to-image transform and one color pipeline. */
export const wallpaperSampleGLSL=`
 uniform sampler2D image; uniform float imageAspect; uniform float viewportAspect;
 uniform float time; uniform float bounce; uniform float light;
 uniform float waves; uniform float waveAudio; uniform float waveAmplitudeX; uniform float waveAmplitudeY;
 uniform float waveFrequencyX; uniform float waveFrequencyY; uniform float waveSpeedX; uniform float waveSpeedY;
 uniform vec3 imageTint; uniform float imageTintEnabled; uniform vec3 pulseTintLow; uniform vec3 pulseTintHigh;
 uniform vec3 feedbackColor; uniform float feedbackStrength;
 ${sceneCorrectionGLSL}
 ${REFERENCE_PULSE_GLSL}
 ${SCENE_COLOR_SPACE_GLSL}
 vec2 wallpaperCover(){
  return min(vec2(1.0),vec2(viewportAspect/imageAspect,imageAspect/viewportAspect));
 }
 vec3 colourWallpaperPixel(vec3 source){
  vec3 visible=displayColour(correctSceneImage(source));
  vec3 pulsed=referencePulse(visible,pulseTintLow,pulseTintHigh,light);
  if(imageTintEnabled>.5) pulsed*=imageTint;
  return mix(linearColour(pulsed),feedbackColor,feedbackStrength);
 }
 vec3 sampleWallpaper(vec2 screenUV){
  vec2 uv=(screenUV-.5)/bounce+.5;
  uv.x+=waves*waveAudio*waveAmplitudeX*.01*sin(uv.y*6.28318530718*waveFrequencyX+time*waveSpeedX);
  uv.y+=waves*waveAudio*waveAmplitudeY*.01*sin(uv.x*6.28318530718*waveFrequencyY+time*waveSpeedY);
  vec2 coverUV=(uv-.5)*wallpaperCover()+.5;
  return colourWallpaperPixel(texture2D(image,clamp(coverUV,vec2(.001),vec2(.999))).rgb);
 }
`;
