import {normalizeSceneVfx,smoothAudio,audioScale,type SceneVfx} from './vfx';
import {sampleSceneAudio,isSceneAudioConnected,subscribeSceneAudio,disposeSceneAudio} from './audio';
import * as THREE from 'three';

/** A screen-space image behind the existing scene, with the same selection feedback. */
export function createWallpaper(scene: THREE.Scene, requestPaint: () => void) {
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { image: { value: null }, imageAspect: { value: 1 }, viewportAspect: { value: 1 },
      time: {value:0}, bounce:{value:1}, light:{value:0}, lightColor:{value:new THREE.Color('#aa3300')},
      waves:{value:1}, distortion:{value:.4}, glitching:{value:.3},
      feedbackColor: { value: new THREE.Color() }, feedbackStrength: { value: 0 } },
    vertexShader: 'varying vec2 imageUV; void main() { imageUV = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `uniform sampler2D image; uniform float imageAspect; uniform float viewportAspect;
      uniform float time; uniform float bounce; uniform float light; uniform vec3 lightColor;
      uniform float waves; uniform float distortion; uniform float glitching;
      float hash(float n){return fract(sin(n*127.1)*43758.5453);}
      uniform vec3 feedbackColor; uniform float feedbackStrength; varying vec2 imageUV;
      void main() {
        vec2 uv=(imageUV-.5)/bounce+.5;
        // Reference water-wave scale 10, speed 5, strength .025; fixed internals.
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
        color*=mix(vec3(1.0),lightColor*1.2,light);
        gl_FragColor = vec4(mix(color, feedbackColor, feedbackStrength), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2), mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = -100000; mesh.visible = false; mesh.raycast = () => {};
  scene.add(mesh);
  let texture: THREE.Texture | null = null, epoch = 0, alive = true;
  let settings=normalizeSceneVfx(undefined),frame=0,last=0,bass=0,level=0,elapsed=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const cancel=()=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0;};
  const schedule=()=>{
    if(frame||!alive||!mesh.visible||document.hidden||reduced.matches)return;
    if(!settings.waves&&!settings.distortion&&!settings.glitching&&!isSceneAudioConnected()&&bass<.0001&&level<.0001)return;
    frame=requestAnimationFrame(tick);
  };
  const tick=(now:number)=>{
    frame=0;if(!alive||!mesh.visible||document.hidden||reduced.matches)return;
    if(last&&now-last<1000/30){schedule();return;}
    const dt=last?Math.min(.1,(now-last)/1000):0;last=now;elapsed+=dt;
    const audio=sampleSceneAudio();bass=smoothAudio(bass,audio.bass,dt);level=smoothAudio(level,audio.level,dt);
    material.uniforms.time.value=elapsed;
    material.uniforms.bounce.value=audioScale(bass,settings.audioBounce);
    material.uniforms.light.value=audio.active?Math.min(1,Math.pow(level,4)*1.2):0;
    requestPaint();schedule();
  };
  const visibility=()=>{cancel();schedule();};
  const motion=()=>{cancel();material.uniforms.waves.value=reduced.matches?0:Number(settings.waves);material.uniforms.distortion.value=reduced.matches?0:settings.distortion;material.uniforms.glitching.value=reduced.matches?0:settings.glitching;material.uniforms.bounce.value=1;material.uniforms.light.value=0;requestPaint();schedule();};
  const stopAudio=subscribeSceneAudio(schedule);
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);
  return {
    configure(value:SceneVfx){settings=normalizeSceneVfx(value);material.uniforms.lightColor.value.set(settings.audioLight);motion();},
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
    dispose() { alive = false;cancel();stopAudio();disposeSceneAudio();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion); epoch++; texture?.dispose(); scene.remove(mesh); material.dispose(); geometry.dispose(); },
  };
}
