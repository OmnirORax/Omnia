import {textPixelRatio} from '../textureGlow.ts';
import * as T from 'three';
import { createWallpaper } from '../scene/wallpaper.ts';
import {createSceneComposite} from './composite.ts';
import { sceneOutputPixelRatio } from '../renderBudget.ts';

/** Wallpaper and shared graph composition, without decorative VFX. */
export function createPipeline(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,request:()=>void){
 const wallpaper=createWallpaper(scene,request,renderer),appearance=createSceneComposite(renderer,scene,camera);
 appearance.setWallpaper(wallpaper);
 let width=1,height=1,native=false;
 const size=()=>{renderer.setPixelRatio(sceneOutputPixelRatio(width,height,devicePixelRatio,wallpaper.visible));textPixelRatio.value=renderer.getPixelRatio();renderer.setSize(width,height);wallpaper.resize(width,height);appearance.resize(width,height);};
 return {wallpaper,
  resize(w:number,h:number){width=w;height=h;size();},
  render(){if(native!==wallpaper.visible){native=wallpaper.visible;size();}appearance.render();},
  dispose(){appearance.dispose();wallpaper.dispose();}
 };
}
