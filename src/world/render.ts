import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SceneGlow } from '../sceneGlow.ts';
import { createWallpaper } from '../scene/wallpaper.ts';
import { sceneOutputPixelRatio, budgetPixelRatio, RENDER_BUDGET, sceneSampleCount } from '../renderBudget.ts';

// V1's native-resolution wallpaper / bounded graph composition, with its real glow pass.
export function createPipeline(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, request: () => void) {
  const wallpaper = createWallpaper(scene, request, renderer);
  let composer: EffectComposer | undefined, width = 1, height = 1, native = false;
  function reset() {
    if (composer) { for (const pass of composer.passes) pass.dispose(); composer.dispose(); composer = undefined; }
  }
  function size() {
    renderer.setPixelRatio(sceneOutputPixelRatio(width, height, devicePixelRatio, wallpaper.visible)); renderer.setSize(width, height);
    wallpaper.resize(width, height);
    composer?.setPixelRatio(budgetPixelRatio(width, height, devicePixelRatio, RENDER_BUDGET.scenePixels, RENDER_BUDGET.maxSceneDpr)); composer?.setSize(width, height);
  }
  return { wallpaper,
    resize(w: number, h: number) { width = w; height = h; size(); },
    render() {
      if (native !== wallpaper.visible) { native = wallpaper.visible; reset(); size(); }
      if (!composer) {
        const target = new T.WebGLRenderTarget(width, height, { type: T.HalfFloatType, samples: sceneSampleCount(renderer.capabilities.maxSamples) });
        composer = new EffectComposer(renderer, target); composer.addPass(new RenderPass(scene, camera));
        const bloom = new SceneGlow(scene, camera, target.samples); bloom.configure(1, 0); composer.addPass(bloom);
        if (!native) composer.addPass(new OutputPass()); composer.renderToScreen = !native; size();
      }
      if (!native) { composer.render(); return; }
      const background = scene.background, clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha();
      try { scene.background = null; renderer.setClearColor(0, 0); wallpaper.without(() => composer!.render()); }
      finally { scene.background = background; renderer.setClearColor(clear, alpha); }
      wallpaper.renderComposite(composer.readBuffer.texture);
    },
    dispose() { reset(); wallpaper.dispose(); },
  };
}
