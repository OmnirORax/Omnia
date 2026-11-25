import {createDocumentWallpaper} from './documentWallpaper.ts';
import {configureSceneCorrection} from './normalizationShader.ts';
import {createWallpaperSampling,wallpaperSampleGLSL,type WallpaperSampleUniforms} from './wallpaperSample.ts';
import type {Corrections} from './normalization.ts';
import {normalizeSceneVfx,WAVE_CONTROLS,nextVfxDeadline,type SceneVfx} from './vfx.ts';
import {readSceneAudioResponse,configureSceneAudioResponse,isSceneAudioConnected,subscribeSceneAudio,disposeSceneAudio} from './audio.ts';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
export interface WallpaperComposite {readonly visible:boolean;readonly sampleUniforms:WallpaperSampleUniforms;without<T>(render:()=>T):T;renderComposite(world:THREE.Texture):void;}

/** A screen-space image behind the existing scene, with the same selection feedback. */
export function createWallpaper(scene: THREE.Scene, requestPaint: () => void, renderer: THREE.WebGLRenderer) {
  const {correction,uniforms}=createWallpaperSampling();
  const documentWallpaper=createDocumentWallpaper(renderer,uniforms);
  const material = new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{...uniforms,worldLayer:{value:null},compositeWorld:{value:0},sceneGlowPass:{value:0}},
    vertexShader: 'varying vec2 imageUV; void main() { imageUV = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `${wallpaperSampleGLSL}
      uniform float sceneGlowPass; uniform sampler2D worldLayer; uniform float compositeWorld; varying vec2 imageUV;
      void main() {
        if(sceneGlowPass!=0.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
        vec3 outputColor=sampleWallpaper(imageUV);
        if(compositeWorld>.5){
          vec4 world=texture2D(worldLayer,imageUV);
          // Graph RGB is premultiplied over transparent black; bloom is additive.
          outputColor=outputColor*(1.0-clamp(world.a,0.0,1.0))+world.rgb;
        }
        gl_FragColor = vec4(outputColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const compositeQuad=new FullScreenQuad(material);
  const geometry = new THREE.PlaneGeometry(2, 2), mesh = new THREE.Mesh(geometry, material);
  mesh.userData.glowIntensity = 0; mesh.frustumCulled = false; mesh.renderOrder = -100000; mesh.visible = false; mesh.raycast = () => {};
  scene.add(mesh);
  const documentImage=(url?:string)=>{
    const root=document.documentElement;
    if(url)root.style.setProperty('--scene-text-image',`url(${JSON.stringify(url)})`);
    else root.style.removeProperty('--scene-text-image');
    root.toggleAttribute('data-scene-text-image',!!url);
  };
  let texture: THREE.Texture | null = null, epoch = 0, alive = true;
  let settings=normalizeSceneVfx(undefined),frame=0,last=0,deadline=0,elapsed=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const cancel=()=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0;deadline=0;};
  const schedule=()=>{
    if(frame||!alive||!mesh.visible||document.hidden||reduced.matches)return;
    if(!settings.waves&&!isSceneAudioConnected())return;
    frame=requestAnimationFrame(tick);
  };
  const tick=(now:number)=>{
    frame=0;if(!alive||!mesh.visible||document.hidden||reduced.matches)return;
    if(deadline&&now+.1<deadline){schedule();return;}
    deadline=nextVfxDeadline(deadline,now,settings.maxFps);
    const dt=last?Math.min(.1,(now-last)/1000):0;last=now;elapsed+=dt;
    const audio=readSceneAudioResponse();
    material.uniforms.time.value=elapsed;
    material.uniforms.light.value=audio.light;
    // Wave audio response is temporarily disabled; keep authored displacement unchanged.
    material.uniforms.bounce.value=1+audio.bounce;
    requestPaint();schedule();
  };
  const visibility=()=>{cancel();schedule();};
  const motion=()=>{cancel();material.uniforms.waves.value=reduced.matches?0:Number(settings.waves);material.uniforms.bounce.value=1;material.uniforms.light.value=0;material.uniforms.waveAudio.value=1;requestPaint();schedule();};
  const stopAudio=subscribeSceneAudio(()=>{if(!isSceneAudioConnected()){material.uniforms.bounce.value=1;material.uniforms.light.value=0;material.uniforms.waveAudio.value=1;requestPaint();}schedule();});
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);
  return {
    get visible(){return mesh.visible;},
    sampleUniforms:uniforms,
    without<T>(render:()=>T){const visible=mesh.visible;mesh.visible=false;try{return render();}finally{mesh.visible=visible;}},
    renderComposite(world:THREE.Texture){
      material.uniforms.worldLayer.value=world;material.uniforms.compositeWorld.value=1;
      try{renderer.setRenderTarget(null);compositeQuad.render(renderer);}
      finally{material.uniforms.worldLayer.value=null;material.uniforms.compositeWorld.value=0;}
    },
    configure(value:SceneVfx){
      settings=normalizeSceneVfx(value);configureSceneAudioResponse(settings);
      for(const {key} of WAVE_CONTROLS)material.uniforms[key].value=settings[key];
      for(const key of ['pulseTintLow','pulseTintHigh','imageTint'] as const){
        const rgb=new THREE.Color(settings[key]).getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace);
        material.uniforms[key].value.set(rgb.r,rgb.g,rgb.b);
      }
      uniforms.imageTintEnabled.value=Number(settings.imageTintEnabled);
      documentWallpaper.refresh();
      material.uniforms.waves.value=reduced.matches?0:Number(settings.waves);


      requestPaint();schedule();
    },
    setURL(url:string|null){return this.setSource(url);},
    async setSource(url:string|HTMLCanvasElement|null,keepPrevious=false){
      const mine=++epoch;
      if(!url||!keepPrevious){
        configureSceneCorrection(correction,null);cancel();elapsed=0;
        material.uniforms.time.value=0;material.uniforms.bounce.value=1;material.uniforms.light.value=0;material.uniforms.waveAudio.value=1;
        mesh.visible=false;documentImage();texture?.dispose();texture=null;material.uniforms.image.value=null;documentWallpaper.reset();requestPaint();
      }
      if(!url)return;
      try{
        const loaded=typeof url==='string'?await new THREE.TextureLoader().loadAsync(url):new THREE.CanvasTexture(url);
        if(!alive||mine!==epoch){loaded.dispose();return;}
        loaded.colorSpace=THREE.SRGBColorSpace;const previous=texture;texture=loaded;previous?.dispose();
        material.uniforms.image.value=loaded;material.uniforms.imageAspect.value=loaded.image.width/loaded.image.height;
        mesh.visible=true;documentImage(typeof url==='string'?url:undefined);documentWallpaper.reset();requestPaint();schedule();
      }catch{/* Preserve the current same-source image if replacement fails. */}
    },
    setCorrection(value:Corrections|null){configureSceneCorrection(correction,value);documentWallpaper.refresh();requestPaint();},
    resize(width: number, height: number) { material.uniforms.viewportAspect.value = width / height;documentWallpaper.resize(width,height); },
    feedback(color: THREE.Color, strength: number) {
      material.uniforms.feedbackColor.value.copy(color); material.uniforms.feedbackStrength.value = strength;
    },
    dispose() { alive = false;documentImage();documentWallpaper.dispose();cancel();stopAudio();disposeSceneAudio();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion); epoch++; texture?.dispose();scene.remove(mesh);compositeQuad.dispose(); material.dispose(); geometry.dispose(); },
  };
}
