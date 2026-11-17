import type {WallpaperComposite} from '../scene/wallpaper.ts';
import {RENDER_BUDGET,budgetPixelRatio,sceneSampleCount} from '../renderBudget.ts';
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SceneGlow} from '../sceneGlow.ts';
import {defaultSettings} from '../composer/runtime/workspaceActions.ts';
/** Shared graph glow and native-resolution wallpaper composition. */
export function createSceneComposite(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
 const appearance=defaultSettings().appearance;
 scene.background=new THREE.Color(appearance.theme==='neon'?appearance.background:0x101927);
 let composer:EffectComposer|null=null,bloom:SceneGlow|null=null,output:OutputPass|null=null;
 let wallpaper:WallpaperComposite|null=null,pipelineWallpaper=false,pipelineGlow=false,width=1,height=1,failed=false;
 const graphRatio=()=>wallpaper?.visible?budgetPixelRatio(width,height,window.devicePixelRatio,RENDER_BUDGET.scenePixels,RENDER_BUDGET.maxSceneDpr):renderer.getPixelRatio();
  const disposeBloom = () => {
    bloom?.dispose();
    output?.dispose();
    composer?.dispose();
    bloom = null;
    output = null;
    composer = null;
  };
 return {
 setWallpaper(value:WallpaperComposite){wallpaper=value;},
    resize(w: number, h: number) {
      width = w;
      height = h;
      // The graph retains its own pixel budget while wallpaper output can be native.
      // Without wallpaper, use the existing renderer density.
      if (composer) { composer.setPixelRatio(graphRatio()); composer.setSize(w, h); }
    },
    render() {
      const nativeWallpaper=Boolean(wallpaper?.visible),glow=appearance.theme==='neon'&&appearance.glow>0;
      if(composer&&(pipelineWallpaper!==nativeWallpaper||pipelineGlow!==glow))disposeBloom();
      if ((nativeWallpaper||glow) && !failed) {
        try {
          if (!composer) {
            const target = new THREE.WebGLRenderTarget(width, height, {
              type: THREE.HalfFloatType,
              samples: sceneSampleCount(renderer.capabilities.maxSamples),
            });
            composer = new EffectComposer(renderer, target);
            composer.addPass(new RenderPass(scene, camera));
            if(glow){
              bloom = new SceneGlow(scene, camera, target.samples);
              bloom.configure(appearance.glow, appearance.glowSpread);composer.addPass(bloom);
            }
            if(!nativeWallpaper){output = new OutputPass();composer.addPass(output);}
            composer.renderToScreen=!nativeWallpaper;
            composer.setPixelRatio(graphRatio());composer.setSize(width, height);
            pipelineWallpaper=nativeWallpaper;pipelineGlow=glow;
          }
          if(nativeWallpaper&&wallpaper){
            const background=scene.background,clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
            try{
              scene.background=null;renderer.setClearColor(0,0);
              wallpaper.without(()=>composer!.render());
            }finally{scene.background=background;renderer.setClearColor(clear,alpha);}
            // Composite a native-resolution image after graph-only AA/glow. Apply
            // output colour conversion once, in the wallpaper's final shader.
            wallpaper.renderComposite(composer.readBuffer.texture);
          }else composer.render();
          return;
        } catch {
          failed = true;disposeBloom();renderer.setRenderTarget(null);
        }
      }
      renderer.render(scene, camera);
    },
 dispose(){disposeBloom();}
 };
}
