import {sceneGlowDetail} from './sceneGlowDetail.ts';
import {inheritedValue} from './graph/inheritedValue.ts';
import {inheritMaterialCoverage} from './materialCoverage.ts';
import { sceneEdgeAA } from "./sceneEdgeAA.ts";
import { bloomSize } from "./renderBudget.ts";
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

type Colored = THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null; alphaMap?: THREE.Texture | null };
/** Selective, narrow bloom. The base image stays untouched, including at zero glow. */
export class SceneGlow extends Pass {
  private target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  private bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0, 0);
  private cache = new Map<THREE.Material, THREE.Material>();
  private mix = new THREE.ShaderMaterial({
    uniforms: { edgeAA: {value:1}, texel: { value: new THREE.Vector2(1, 1) }, base: { value: null }, glowStrength:{value:0}, narrowGlow:{value:this.bloom.renderTargetsVertical[0].texture}, glow: { value: this.bloom.renderTargetsHorizontal[0].texture } },
    vertexShader: 'varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float edgeAA; uniform float glowStrength; uniform sampler2D base; uniform sampler2D glow; uniform sampler2D narrowGlow; varying vec2 uv0; ${sceneEdgeAA} ${sceneGlowDetail} void main(){vec4 center=texture2D(base,uv0);gl_FragColor=vec4((edgeAA>.5?edgeColor(base,uv0,center.rgb):center.rgb)+detailGlow(base,glow,narrowGlow,uv0,texel,center.rgb,glowStrength),center.a);}`,
    depthTest: false, depthWrite: false,
  });
  private quad = new FullScreenQuad(this.mix);
  private scene:THREE.Scene;
  private camera:THREE.Camera;
  constructor(scene: THREE.Scene, camera: THREE.Camera, samples: number) {
    super();this.scene=scene;this.camera=camera; this.mix.uniforms.edgeAA.value=samples>0?0:1;this.target.samples = 0;
    // Only these two levels have ever contributed to configure()'s halo.
    // Remove the unused shader terms before releasing their buffers; merely
    // changing nMips would leave the composite sampling stale textures.
    const material=this.bloom.compositeMaterial;
    const unused=/\+\s*lerpBloomFactor\( bloomFactors\[ [234] \] \) \* bloomTintColors\[ [234] \] \* texture2D\( blurTexture[345], vUv \)\.rgb/g;
    // A Three.js shader change must fall back to its full pipeline, rather
    // than disposing buffers a changed shader might still sample.
    if([...material.fragmentShader.matchAll(unused)].length===3){
      material.fragmentShader=material.fragmentShader.replace(unused,'');
      material.defines.NUM_MIPS=2;
      material.uniforms.bloomFactors.value=material.uniforms.bloomFactors.value.slice(0,2);
      this.bloom.bloomTintColors.splice(2);
      material.needsUpdate=true;
      this.bloom.nMips=2;
      for(const list of [this.bloom.renderTargetsHorizontal,this.bloom.renderTargetsVertical,this.bloom.separableBlurMaterials])for(const resource of list.splice(2))resource.dispose();
    }
  }
  configure(strength: number, spread: number) {
    this.bloom.strength = strength;
    this.mix.uniforms.glowStrength.value=strength;
    // Keep only the close blur scales. Broad, low-resolution layers create haze.
    this.bloom.compositeMaterial.uniforms.bloomFactors.value = this.bloom.nMips===2?[1,spread*.12]:[1,spread*.12,0,0,0];
  }
  private mask(original: THREE.Material, intensity: number) {
    let material = this.cache.get(original);
    if (!material) {
      if (original instanceof THREE.ShaderMaterial || original instanceof THREE.LineBasicMaterial || original instanceof THREE.PointsMaterial || original instanceof THREE.SpriteMaterial) material = original.clone();
      else material = new THREE.MeshBasicMaterial({ map: (original as Colored).map, alphaMap: (original as Colored).alphaMap, side: original.side });
      inheritMaterialCoverage(original,material);
      this.cache.set(original, material);
    }
    material.transparent = original.transparent; material.opacity = original.opacity;
    material.depthTest = original.depthTest; material.depthWrite = original.depthWrite; material.alphaTest = original.alphaTest;
    material.visible = original.visible;
    const color = (material as Colored).color;
    if (color) color.copy((original as Colored).color ?? new THREE.Color("white")).multiplyScalar(intensity);
    // Shaders declaring this capability supply their own emission-only bloom mask.
    // Share live uniforms so audio/time/texture changes cannot freeze in a cached clone.
    if (material instanceof THREE.ShaderMaterial && original instanceof THREE.ShaderMaterial && original.uniforms.sceneGlowPass) {
      for (const key in original.uniforms) if(key!=='sceneGlowPass') material.uniforms[key]=original.uniforms[key];
      material.uniforms.sceneGlowPass.value=intensity>0?intensity:-1;
    }
    if (material instanceof THREE.ShaderMaterial && original instanceof THREE.ShaderMaterial && material.uniforms.resolution && original.uniforms.resolution) material.uniforms.resolution.value.copy(original.uniforms.resolution.value);
    return material;
  }
  override render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget, delta: number) {
    const saved: { object: THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite; material: THREE.Material | THREE.Material[] }[] = [];
    const used = new Set<THREE.Material>(), background = this.scene.background;
    try {
      this.scene.background = new THREE.Color(0);
      this.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
        const intensity = inheritedValue(object,'glowIntensity',0);
        saved.push({ object, material: object.material });
        const mask = (original: THREE.Material) => { used.add(original); return this.mask(original, intensity); };
        object.material = Array.isArray(object.material) ? object.material.map(mask) : mask(object.material);
      });
      renderer.setRenderTarget(this.target); renderer.clear(); renderer.render(this.scene, this.camera);
    } finally {
      for (const { object, material } of saved) object.material = material;
      this.scene.background = background;
    }
    for (const [original, material] of this.cache) if (!used.has(original)) { material.dispose(); this.cache.delete(original); }
    this.bloom.render(renderer, write, this.target, delta, false);
    this.mix.uniforms.base.value = read.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer);
  }
  override setSize(width: number, height: number) { this.mix.uniforms.texel.value.set(1 / Math.max(1, width), 1 / Math.max(1, height)); const size = bloomSize(width, height); this.target.setSize(size.width, size.height); this.bloom.setSize(size.width, size.height); }
  override dispose() { this.target.dispose(); this.bloom.dispose(); this.mix.dispose(); this.quad.dispose(); for (const material of this.cache.values()) material.dispose(); this.cache.clear(); }
}
