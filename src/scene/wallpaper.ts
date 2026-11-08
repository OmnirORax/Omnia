import {createSphereBackground,sphereBackgroundGLSL,sphereBackgroundUniforms,type SphereBackground} from './sphereBlend.ts';
import * as THREE from 'three';

/** A screen-space image behind the existing scene, with the same selection feedback. */
export function createWallpaper(scene: THREE.Scene, requestPaint: () => void, background:SphereBackground=createSphereBackground()) {
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {...sphereBackgroundUniforms(background),feedbackColor:{value:new THREE.Color()},feedbackStrength:{value:0}},
    vertexShader: 'varying vec2 imageUV; void main() { imageUV = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: sphereBackgroundGLSL+`uniform vec3 feedbackColor; uniform float feedbackStrength; varying vec2 imageUV;
      void main(){gl_FragColor=vec4(mix(sphereBackground(imageUV,0.0),feedbackColor,feedbackStrength),1.0);
      #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(2, 2), mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = -100000; mesh.visible = false; mesh.raycast = () => {};
  scene.add(mesh);
  let texture: THREE.Texture | null = null, epoch = 0, alive = true;
  return {
    async setURL(url: string | null,keepPrevious=false) {
      const mine = ++epoch;
      if(!url||!keepPrevious){mesh.visible = false; texture?.dispose(); texture = null; background.image.value = null; background.hasImage.value=0; requestPaint();}
      if (!url) return;
      try {
        const loaded = await new THREE.TextureLoader().loadAsync(url);
        if (!alive || mine !== epoch) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace;const previous=texture; texture = loaded;previous?.dispose();
        background.image.value = loaded; background.hasImage.value=1;
        background.imageAspect.value = loaded.image.width / loaded.image.height;
        mesh.visible = true; requestPaint();
      } catch { /* Keep the theme background if decoding fails; no scene/camera reset. */ }
    },
    resize(width: number, height: number) { background.viewportAspect.value = width / height; },
    feedback(color: THREE.Color, strength: number) {
      material.uniforms.feedbackColor.value.copy(color); material.uniforms.feedbackStrength.value = strength;
    },
    dispose() { alive = false; epoch++; texture?.dispose(); scene.remove(mesh); material.dispose(); geometry.dispose(); },
  };
}
