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
    uniforms: { base: { value: null }, glow: { value: this.bloom.renderTargetsHorizontal[0].texture } },
    vertexShader: 'varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D base; uniform sampler2D glow; varying vec2 uv0; void main(){vec4 b=texture2D(base,uv0);gl_FragColor=vec4(b.rgb+texture2D(glow,uv0).rgb,b.a);}',
    depthTest: false, depthWrite: false,
  });
  private quad = new FullScreenQuad(this.mix);
  constructor(private scene: THREE.Scene, private camera: THREE.Camera, samples: number) { super(); this.target.samples = Math.min(4, samples); }
  configure(strength: number, spread: number) {
    this.bloom.strength = strength;
    // Keep only the close blur scales. Broad, low-resolution layers create haze.
    this.bloom.compositeMaterial.uniforms.bloomFactors.value = [1, spread * 0.12, 0, 0, 0];
  }
  private mask(original: THREE.Material, intensity: number) {
    let material = this.cache.get(original);
    if (!material) {
      if (original instanceof THREE.ShaderMaterial || original instanceof THREE.LineBasicMaterial || original instanceof THREE.PointsMaterial || original instanceof THREE.SpriteMaterial) material = original.clone();
      else material = new THREE.MeshBasicMaterial({ map: (original as Colored).map, alphaMap: (original as Colored).alphaMap, side: original.side });
      this.cache.set(original, material);
    }
    material.transparent = original.transparent; material.opacity = original.opacity;
    material.depthTest = original.depthTest; material.depthWrite = original.depthWrite; material.alphaTest = original.alphaTest;
    material.visible = original.visible;
    const color = (material as Colored).color;
    if (color) color.copy((original as Colored).color ?? new THREE.Color("white")).multiplyScalar(intensity);
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
        let owner: THREE.Object3D | null = object;
        while (owner && owner.userData.glowIntensity === undefined) owner = owner.parent;
        const intensity = owner?.userData.glowIntensity ?? 0;
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
  override setSize(width: number, height: number) { this.target.setSize(width, height); this.bloom.setSize(width, height); }
  override dispose() { this.target.dispose(); this.bloom.dispose(); this.mix.dispose(); this.quad.dispose(); for (const material of this.cache.values()) material.dispose(); this.cache.clear(); }
}
