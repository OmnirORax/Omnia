import {createSceneCorrection,configureSceneCorrection,sceneCorrectionGLSL,sceneCorrectionUniforms} from './normalizationShader.ts';
import type {Corrections} from './normalization.ts';
import {REFERENCE_PULSE_GLSL,PULSE_COLOUR_GLSL} from './pulse.ts';
import {normalizeSceneVfx,WAVE_CONTROLS,nextVfxDeadline,type SceneVfx} from './vfx.ts';
import {readSceneAudioResponse,configureSceneAudioResponse,isSceneAudioConnected,subscribeSceneAudio,disposeSceneAudio} from './audio.ts';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
export interface WallpaperComposite {readonly visible:boolean;without<T>(render:()=>T):T;renderComposite(world:THREE.Texture):void;}

/** A screen-space image behind the existing scene, with the same selection feedback. */
export function createWallpaper(scene: THREE.Scene, requestPaint: () => void, renderer: THREE.WebGLRenderer) {
  const initial=normalizeSceneVfx(undefined),correction=createSceneCorrection();
  const tint=(hex:string)=>{const c=new THREE.Color(hex).getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace);return new THREE.Vector3(c.r,c.g,c.b);};
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,defines:{PULSE_ALL_COLORS:0,IMAGE_TINT:0},
    uniforms: { ...sceneCorrectionUniforms(correction), worldLayer:{value:null},compositeWorld:{value:0},image: { value: null }, imageAspect: { value: 1 }, viewportAspect: { value: 1 },
      pulseOmniTintLow:{value:tint(initial.pulseOmniTintLow)},pulseOmniTint:{value:tint(initial.pulseOmniTint)},imageTint:{value:tint(initial.imageTint)},
      pulseTintLow:{value:tint(initial.pulseTintLow)},pulseTintHigh:{value:tint(initial.pulseTintHigh)},sceneGlowPass:{value:0},time:{value:0},bounce:{value:1},light:{value:0},
      ...Object.fromEntries(WAVE_CONTROLS.map(({key,initial})=>[key,{value:initial}])),waves:{value:1},waveAudio:{value:1},
      feedbackColor: { value: new THREE.Color() }, feedbackStrength: { value: 0 } },
    vertexShader: 'varying vec2 imageUV; void main() { imageUV = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `uniform sampler2D image; uniform float imageAspect; uniform float viewportAspect;
      uniform float sceneGlowPass; uniform float time; uniform float bounce; uniform float light;
      uniform float waves; uniform float waveAudio; uniform float waveAmplitudeX; uniform float waveAmplitudeY;
      uniform float waveFrequencyX; uniform float waveFrequencyY; uniform float waveSpeedX; uniform float waveSpeedY;
      uniform vec3 imageTint;uniform vec3 pulseTintLow;uniform vec3 pulseTintHigh;
      ${sceneCorrectionGLSL}
      ${REFERENCE_PULSE_GLSL}
      uniform sampler2D worldLayer;uniform float compositeWorld;
      ${PULSE_COLOUR_GLSL}
      uniform vec3 feedbackColor; uniform float feedbackStrength; varying vec2 imageUV;
      void main() {
        if(sceneGlowPass!=0.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
        vec2 uv=(imageUV-.5)/bounce+.5;
        // Approximation only: original waterwaves shader/project-layer setup is missing.
        // Extracted numbers do not establish equivalent UV displacement.
        uv.x+=waves*waveAudio*waveAmplitudeX*.01*sin(uv.y*6.28318530718*waveFrequencyX+time*waveSpeedX);
        uv.y+=waves*waveAudio*waveAmplitudeY*.01*sin(uv.x*6.28318530718*waveFrequencyY+time*waveSpeedY);
        vec2 coverUV = uv - 0.5;
        if (viewportAspect > imageAspect) coverUV.y *= imageAspect / viewportAspect;
        else coverUV.x *= viewportAspect / imageAspect;
        vec3 color = correctSceneImage(texture2D(image, clamp(coverUV + 0.5,vec2(.001),vec2(.999))).rgb);
        vec3 visible=displayColour(color);
        #if PULSE_ALL_COLORS
        vec3 coloured=referencePulse(visible,omniHighTint(visible,pulseOmniTintLow),omniHighTint(visible,pulseOmniTint),light);
        vec3 enhanced=linearColour(coloured);
        #if IMAGE_TINT
        enhanced=linearColour(displayColour(enhanced)*imageTint);
        #endif
        #else
        vec3 pulsed=referencePulse(visible,pulseTintLow,pulseTintHigh,light);
        #if IMAGE_TINT
        pulsed*=imageTint;
        #endif
        vec3 enhanced=linearColour(pulsed);
        #endif
        vec3 outputColor=mix(enhanced,feedbackColor,feedbackStrength);
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
    material.uniforms.light.value=2*audio.light;
    // Wave audio response is temporarily disabled; keep authored displacement unchanged.
    material.uniforms.bounce.value=1+.5*audio.bounce;
    requestPaint();schedule();
  };
  const visibility=()=>{cancel();schedule();};
  const motion=()=>{cancel();material.uniforms.waves.value=reduced.matches?0:Number(settings.waves);material.uniforms.bounce.value=1;material.uniforms.light.value=0;material.uniforms.waveAudio.value=1;requestPaint();schedule();};
  const stopAudio=subscribeSceneAudio(()=>{if(!isSceneAudioConnected()){material.uniforms.bounce.value=1;material.uniforms.light.value=0;material.uniforms.waveAudio.value=1;requestPaint();}schedule();});
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);
  return {
    get visible(){return mesh.visible;},
    without<T>(render:()=>T){const visible=mesh.visible;mesh.visible=false;try{return render();}finally{mesh.visible=visible;}},
    renderComposite(world:THREE.Texture){
      material.uniforms.worldLayer.value=world;material.uniforms.compositeWorld.value=1;
      try{renderer.setRenderTarget(null);compositeQuad.render(renderer);}
      finally{material.uniforms.worldLayer.value=null;material.uniforms.compositeWorld.value=0;}
    },
    configure(value:SceneVfx){
      settings=normalizeSceneVfx(value);configureSceneAudioResponse(settings.audioResponse);
      for(const {key} of WAVE_CONTROLS)material.uniforms[key].value=settings[key];
      for(const key of ['pulseTintLow','pulseTintHigh','imageTint'] as const){
        const rgb=new THREE.Color(settings[key]).getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace);
        material.uniforms[key].value.set(rgb.r,rgb.g,rgb.b);
      }
      const all=Number(settings.pulseColorMode==='all');
      if(material.defines.PULSE_ALL_COLORS!==all){material.defines.PULSE_ALL_COLORS=all;material.needsUpdate=true;}
      material.uniforms.pulseOmniTint.value.copy(tint(settings.pulseOmniTint));
      material.uniforms.pulseOmniTintLow.value.copy(tint(settings.pulseOmniTintLow));
      const filter=Number(settings.imageTintEnabled);
      if(material.defines.IMAGE_TINT!==filter){material.defines.IMAGE_TINT=filter;material.needsUpdate=true;}
      material.uniforms.waves.value=reduced.matches?0:Number(settings.waves);


      requestPaint();schedule();
    },
    setURL(url:string|null){return this.setSource(url);},
    async setSource(url:string|HTMLCanvasElement|null,keepPrevious=false){
      const mine=++epoch;
      if(!url||!keepPrevious){
        configureSceneCorrection(correction,null);cancel();elapsed=0;
        material.uniforms.time.value=0;material.uniforms.bounce.value=1;material.uniforms.light.value=0;material.uniforms.waveAudio.value=1;
        mesh.visible=false;texture?.dispose();texture=null;material.uniforms.image.value=null;requestPaint();
      }
      if(!url)return;
      try{
        const loaded=typeof url==='string'?await new THREE.TextureLoader().loadAsync(url):new THREE.CanvasTexture(url);
        if(!alive||mine!==epoch){loaded.dispose();return;}
        loaded.colorSpace=THREE.SRGBColorSpace;const previous=texture;texture=loaded;previous?.dispose();
        material.uniforms.image.value=loaded;material.uniforms.imageAspect.value=loaded.image.width/loaded.image.height;
        mesh.visible=true;requestPaint();schedule();
      }catch{/* Preserve the current same-source image if replacement fails. */}
    },
    setCorrection(value:Corrections|null){configureSceneCorrection(correction,value);requestPaint();},
    resize(width: number, height: number) { material.uniforms.viewportAspect.value = width / height; },
    feedback(color: THREE.Color, strength: number) {
      material.uniforms.feedbackColor.value.copy(color); material.uniforms.feedbackStrength.value = strength;
    },
    dispose() { alive = false;cancel();stopAudio();disposeSceneAudio();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion); epoch++; texture?.dispose();scene.remove(mesh);compositeQuad.dispose(); material.dispose(); geometry.dispose(); },
  };
}
