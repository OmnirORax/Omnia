import {importLocalScene,listLocalScenes,localSceneBlob,deleteLocalScene,type ScenePromptSnapshot} from './library.ts';
import {DEFAULT_BACKGROUND} from './defaultBackground.ts';
export type SceneImage={id:string;name:string;state?:string;created_by?:string;localId?:string;media_type?:string};
export type SceneStorage={key:string;writable:()=>boolean;current:()=>boolean;list:()=>Promise<SceneImage[]>;upload:(file:File,input:ScenePromptSnapshot|null)=>Promise<SceneImage>;download:(image:SceneImage)=>Promise<Blob>;remove:(image:SceneImage,after?:()=>void)=>Promise<unknown>;canFinalize?:(image:SceneImage)=>boolean;finalize?:(image:SceneImage)=>Promise<unknown>};
export const localSceneStorage:SceneStorage={key:'local',writable:()=>true,current:()=>true,list:listLocalScenes,upload:importLocalScene,download:image=>localSceneBlob(image.id),remove:(image,after)=>image.id===DEFAULT_BACKGROUND.id?Promise.resolve():deleteLocalScene(image.id,true,after)};
