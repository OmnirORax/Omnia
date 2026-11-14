import * as T from 'three';
import { createWallpaper } from '../scene/wallpaper.ts';
import { createSceneAppearance } from './v1/sceneAppearance.ts';
import { defaultSettings } from '../composer/runtime/workspaceActions.ts';
import { sceneOutputPixelRatio } from '../renderBudget.ts';
import type {TextScene} from './v1/types.ts';

/** V1's world effects and compositor, using the current wallpaper/audio owner. */
export function createPipeline(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,request:()=>void,sources:()=>TextScene){
 const wallpaper=createWallpaper(scene,request,renderer),appearance=createSceneAppearance(renderer,scene,camera);
 appearance.setWallpaper(wallpaper);appearance.setSources(sources);appearance.configure(defaultSettings().appearance);appearance.start(request);
 let width=1,height=1,native=false;
 const size=()=>{renderer.setPixelRatio(sceneOutputPixelRatio(width,height,devicePixelRatio,wallpaper.visible));renderer.setSize(width,height);wallpaper.resize(width,height);appearance.resize(width,height);};
 return {wallpaper,resize(w:number,h:number){width=w;height=h;size();},render(){if(native!==wallpaper.visible){native=wallpaper.visible;size();}appearance.render();},dispose(){appearance.dispose();wallpaper.dispose();}};
}
