import {REFERENCE_PULSE_GLSL,PULSE_COLOUR_GLSL} from './pulse.ts';
import {normalizeSceneVfx,smoothAudio,followBass,createBassDynamics,audioScale,nextVfxDeadline,type SceneVfx} from './vfx.ts';
import {sampleSceneAudio,sampleScenePulse,isSceneAudioConnected,subscribeSceneAudio,disposeSceneAudio} from './audio.ts';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
export interface WallpaperComposite {readonly visible:boolean;without<T>(render:()=>T):T;renderComposite(world:THREE.Texture):void;}

/** A screen-space image behind the existing scene, with the same selection feedback. */
export function createWallpaper(scene: THREE.Scene, requestPaint: () => void, renderer: THREE.WebGLRenderer) {
  const initial=normalizeSceneVfx(undefined);
  const tint=(hex:string)=>{const c=new THREE.Color(hex).getRGB({r:0,g:0,b:0},THREE.SRGBColorSpace);return new THREE.Vector3(c.r,c.g,c.b);};
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,defines:{PULSE_ALL_COLORS:0,IMAGE_TINT:0},
    uniforms: { worldLayer:{value:null},compositeWorld:{value:0},image: { value: null }, imageAspect: { value: 1 }, viewportAspect: { value: 1 },
      pulseOmniTintLow:{value:tint(initial.pulseOmniTintLow)},pulseOmniTint:{value:tint(initial.pulseOmniTint)},imageTint:{value:tint(initial.imageTint)},
      pulseTintLow:{value:tint(initial.pulseTintLow)},pulseTintHigh:{value:tint(initial.pulseTintHigh)},sceneGlowPass:{value:0},time:{value:0},bounce:{value:1},light:{value:0},
      waves:{value:1}, distortion:{value:.4}, glitching:{value:.3},
      feedbackColor: { value: new THREE.Color() }, feedbackStrength: { value: 0 } },
    vertexShader: 'varying vec2 imageUV; void main() { imageUV = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `uniform sampler2D image; uniform float imageAspect; uniform float viewportAspect;
      uniform float sceneGlowPass; uniform float time; uniform float bounce; uniform float light;
      uniform float waves; uniform float distortion; uniform float glitching;
      uniform vec3 imageTint;uniform vec3 pulseTintLow;uniform vec3 pulseTintHigh;
      ${REFERENCE_PULSE_GLSL}
      uniform sampler2D worldLayer;uniform float compositeWorld;
      float hash(float n){return fract(sin(n*127.1)*43758.5453);}
      ${PULSE_COLOUR_GLSL}
      uniform vec3 feedbackColor; uniform float feedbackStrength; varying vec2 imageUV;
      void main() {
        if(sceneGlowPass!=0.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
        vec2 uv=(imageUV-.5)/bounce+.5;
        // Approximation only: original waterwaves shader/project-layer setup is missing.
        // Extracted numbers do not establish equivalent UV displacement.
        uv.x+=waves*.025*sin(uv.y*62.83185+time*5.0)*.35;
        uv.y+=waves*.025*sin(uv.x*62.83185-time*3.5)*.2;
        // One shared VHS pass: slow bending plus brief horizontal tracking bands.
        uv.x+=distortion*.02*sin(uv.y*12.566+time*.5);
        float frame=floor(time*12.0),band=floor(uv.y*36.0);
        float tear=step(.94,hash(frame+band*19.0));
        uv.x+=(hash(frame*7.0+band)-.5)*glitching*.07*tear;
        vec2 coverUV = uv - 0.5;
        if (viewportAspect > imageAspect) coverUV.y *= imageAspect / viewportAspect;
        else coverUV.x *= viewportAspect / imageAspect;
        vec3 color = texture2D(image, clamp(coverUV + 0.5,vec2(.001),vec2(.999))).rgb;
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
  const bassDynamics=createBassDynamics();
  let settings=normalizeSceneVfx(undefined),frame=0,last=0,deadline=0,bass=0,level=0,elapsed=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const cancel=()=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0;deadline=0;};
  const schedule=()=>{
    if(frame||!alive||!mesh.visible||document.hidden||reduced.matches)return;
    if(!settings.waves&&!settings.distortion&&!settings.glitching&&!isSceneAudioConnected()&&bass<.0001&&level<.0001)return;
    frame=requestAnimationFrame(tick);
  };
  const tick=(now:number)=>{
    frame=0;if(!alive||!mesh.visible||document.hidden||reduced.matches)return;
    if(deadline&&now+.1<deadline){schedule();return;}
    deadline=nextVfxDeadline(deadline,now,settings.maxFps);
    const dt=last?Math.min(.1,(now-last)/1000):0;last=now;elapsed+=dt;
    const pulse=sampleScenePulse(settings,dt),audio=sampleSceneAudio();
    bass=settings.pulseRangeMode==='auto'?followBass(bass,bassDynamics.sample(audio.bassAmplitude,dt),dt):smoothAudio(bass,audio.bass,dt);level=smoothAudio(level,audio.level,dt);
    material.uniforms.time.value=elapsed;
    material.uniforms.light.value=pulse;
    material.uniforms.bounce.value=audioScale(bass,settings.audioBounce);
    requestPaint();schedule();
  };
  const visibility=()=>{cancel();schedule();};
  const motion=()=>{cancel();material.uniforms.waves.value=reduced.matches?0:Number(settings.waves);material.uniforms.distortion.value=reduced.matches?0:settings.distortion;material.uniforms.glitching.value=reduced.matches?0:settings.glitching;material.uniforms.bounce.value=1;material.uniforms.light.value=0;requestPaint();schedule();};
  const stopAudio=subscribeSceneAudio(()=>{bassDynamics.reset();schedule();});
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
      if(settings.pulseRangeMode!==value.pulseRangeMode)bassDynamics.reset();
      settings=normalizeSceneVfx(value);
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
      motion();
    },
    async setURL(url: string | null) {
      const mine = ++epoch;
      cancel();bass=0;level=0;elapsed=0;material.uniforms.time.value=0;material.uniforms.bounce.value=1;material.uniforms.light.value=0;
      mesh.visible = false; texture?.dispose(); texture = null; material.uniforms.image.value = null; requestPaint();
      if (!url) return;
      try {
        const loaded = await new THREE.TextureLoader().loadAsync(url);
        if (!alive || mine !== epoch) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace; texture = loaded;
        material.uniforms.image.value = loaded;
        material.uniforms.imageAspect.value = loaded.image.width / loaded.image.height;
        mesh.visible = true; requestPaint();schedule();
      } catch { /* Keep the theme background if decoding fails; no scene/camera reset. */ }
    },
    resize(width: number, height: number) { material.uniforms.viewportAspect.value = width / height; },
    feedback(color: THREE.Color, strength: number) {
      material.uniforms.feedbackColor.value.copy(color); material.uniforms.feedbackStrength.value = strength;
    },
    dispose() { alive = false;cancel();stopAudio();disposeSceneAudio();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion); epoch++; texture?.dispose();scene.remove(mesh);compositeQuad.dispose(); material.dispose(); geometry.dispose(); },
  };
}
