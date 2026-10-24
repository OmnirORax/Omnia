import * as THREE from 'three';

/** A screen-space image behind the existing scene, with the same selection feedback. */
export function createWallpaper(scene: THREE.Scene, requestPaint: () => void) {
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { image: { value: null }, imageAspect: { value: 1 }, viewportAspect: { value: 1 },
      feedbackColor: { value: new THREE.Color() }, feedbackStrength: { value: 0 } },
    vertexShader: 'varying vec2 imageUV; void main() { imageUV = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: `uniform sampler2D image; uniform float imageAspect; uniform float viewportAspect;
      uniform vec3 feedbackColor; uniform float feedbackStrength; varying vec2 imageUV;
      void main() {
        vec2 coverUV = imageUV - 0.5;
        if (viewportAspect > imageAspect) coverUV.y *= imageAspect / viewportAspect;
        else coverUV.x *= viewportAspect / imageAspect;
        vec3 color = texture2D(image, coverUV + 0.5).rgb;
        gl_FragColor = vec4(mix(color, feedbackColor, feedbackStrength), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2), mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = -100000; mesh.visible = false; mesh.raycast = () => {};
  scene.add(mesh);
  let texture: THREE.Texture | null = null, epoch = 0, alive = true;
  return {
    async setURL(url: string | null) {
      const mine = ++epoch;
      mesh.visible = false; texture?.dispose(); texture = null; material.uniforms.image.value = null; requestPaint();
      if (!url) return;
      try {
        const loaded = await new THREE.TextureLoader().loadAsync(url);
        if (!alive || mine !== epoch) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace; texture = loaded;
        material.uniforms.image.value = loaded;
        material.uniforms.imageAspect.value = loaded.image.width / loaded.image.height;
        mesh.visible = true; requestPaint();
      } catch { /* Keep the theme background if decoding fails; no scene/camera reset. */ }
    },
    resize(width: number, height: number) { material.uniforms.viewportAspect.value = width / height; },
    feedback(color: THREE.Color, strength: number) {
      material.uniforms.feedbackColor.value.copy(color); material.uniforms.feedbackStrength.value = strength;
    },
    dispose() { alive = false; epoch++; texture?.dispose(); scene.remove(mesh); material.dispose(); geometry.dispose(); },
  };
}
