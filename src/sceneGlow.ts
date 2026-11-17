import {glowScale,projectedGlowDetail} from './glowScale.ts';
import {inheritedOwner} from './graph/inheritedValue.ts';
import {inheritMaterialCoverage,materialGlowDetail} from './materialCoverage.ts';
import { bloomSize } from "./renderBudget.ts";
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

type Colored = THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null; alphaMap?: THREE.Texture | null };
/** Selective, narrow bloom. The base image stays untouched, including at zero glow. */
export class SceneGlow extends Pass {
  private target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  private bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0, 0);
  private cache = new Map<THREE.Object3D,Map<THREE.Material,{material:THREE.Material;frame:number}>>();
  private frame=0;private outputHeight=0;
  private instance=new THREE.Matrix4();private instanceWorld=new THREE.Matrix4();private zero=new THREE.Vector3();
  private mix = new THREE.ShaderMaterial({
    uniforms: { base: { value: null }, glow: { value: this.bloom.renderTargetsHorizontal[0].texture } },
    vertexShader: 'varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D base; uniform sampler2D glow; varying vec2 uv0; void main(){vec4 center=texture2D(base,uv0);gl_FragColor=vec4(center.rgb+texture2D(glow,uv0).rgb,center.a);}`,
    depthTest: false, depthWrite: false,
  });
  private quad = new FullScreenQuad(this.mix);
  private scene:THREE.Scene;
  private camera:THREE.Camera;
  constructor(scene: THREE.Scene, camera: THREE.Camera, _samples: number) {
    super();this.scene=scene;this.camera=camera;this.target.samples = 0;
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
    // Keep only the close blur scales. Broad, low-resolution layers create haze.
    this.bloom.compositeMaterial.uniforms.bloomFactors.value = this.bloom.nMips===2?[1,spread*.12]:[1,spread*.12,0,0,0];
  }
  private scale(object:THREE.Mesh|THREE.Line|THREE.Points|THREE.Sprite,original:THREE.Material){
    if(!this.outputHeight)return 1;
    const bound=object.geometry?.boundingSphere,detail=materialGlowDetail(original,(bound?.radius??.5)*.25);
    let matrix=object.matrixWorld;
    if(object instanceof THREE.InstancedMesh&&object.count){object.getMatrixAt(0,this.instance);matrix=this.instanceWorld.multiplyMatrices(object.matrixWorld,this.instance);}
    if(detail<=0)return 1;
    const pixels=projectedGlowDetail(detail,matrix.elements,this.camera.matrixWorldInverse.elements,this.camera.projectionMatrix.elements[5],this.outputHeight,this.camera instanceof THREE.PerspectiveCamera,bound?.center??this.zero);
    return glowScale(pixels);
  }
  private mask(original: THREE.Material, intensity: number,owner:THREE.Object3D) {
    let sources=this.cache.get(owner);if(!sources){sources=new Map();this.cache.set(owner,sources);}
    const entry=sources.get(original);let material=entry?.material;if(entry)entry.frame=this.frame;
    if (!material) {
      if (original instanceof THREE.ShaderMaterial || original instanceof THREE.LineBasicMaterial || original instanceof THREE.PointsMaterial || original instanceof THREE.SpriteMaterial) material = original.clone();
      else material = new THREE.MeshBasicMaterial({ map: (original as Colored).map, alphaMap: (original as Colored).alphaMap, side: original.side });
      inheritMaterialCoverage(original,material);
      sources.set(original,{material,frame:this.frame});
    }
    if('map' in material)(material as Colored).map=(original as Colored).map;
    if('alphaMap' in material)(material as Colored).alphaMap=(original as Colored).alphaMap;
    material.transparent = original.transparent; material.opacity = original.opacity;
    material.depthTest = original.depthTest; material.depthWrite = original.depthWrite; material.alphaTest = original.alphaTest;
    material.visible = original.visible;
    const color = (material as Colored).color;
    if (color) {const tint=inheritedOwner(owner,'glowColor')?.userData.glowColor;if(tint)color.set(tint);else color.copy((original as Colored).color??new THREE.Color('white'));color.multiplyScalar(intensity);}
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
    const saved: { object: THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite; material: THREE.Material | THREE.Material[];owner?:THREE.Object3D;intensity:number }[] = [];
    this.frame++;const background = this.scene.background,ownerScales=new Map<THREE.Object3D,number>();
    try {
      this.scene.background = new THREE.Color(0);
      this.scene.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite)) return;
        const owner=inheritedOwner<THREE.Object3D>(object,'glowIntensity'),intensity=Number(owner?.userData.glowIntensity??0);
        saved.push({ object, material: object.material,owner,intensity });
        if(owner&&intensity>0){
          const sourceScale=(material:THREE.Material)=>material.visible&&material.opacity>0?this.scale(object,material):1;
          const fade=Array.isArray(object.material)?Math.min(...object.material.map(sourceScale)):sourceScale(object.material);
          ownerScales.set(owner,Math.min(ownerScales.get(owner)??1,fade));
        }
      });
      for(const {object,material,owner,intensity}of saved){
        const gain=intensity*(owner?ownerScales.get(owner)??1:1),mask=(source:THREE.Material)=>this.mask(source,gain,object);
        object.material=Array.isArray(material)?material.map(mask):mask(material);
      }
      renderer.setRenderTarget(this.target); renderer.clear(); renderer.render(this.scene, this.camera);
    } finally {
      for (const { object, material } of saved) object.material = material;
      this.scene.background = background;
    }
    for(const [owner,sources]of this.cache){for(const [original,entry]of sources)if(entry.frame!==this.frame){entry.material.dispose();sources.delete(original);}if(!sources.size)this.cache.delete(owner);}
    this.bloom.render(renderer, write, this.target, delta, false);
    this.mix.uniforms.base.value = read.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer);
  }
  override setSize(width: number, height: number) { this.outputHeight=Math.max(1,height); const size = bloomSize(width, height); this.target.setSize(size.width, size.height); this.bloom.setSize(size.width, size.height); }
  override dispose() { this.target.dispose(); this.bloom.dispose(); this.mix.dispose(); this.quad.dispose(); for(const sources of this.cache.values())for(const entry of sources.values())entry.material.dispose(); this.cache.clear(); }
}
