import {checkedWorld,sceneReferences,encodeBytes,type SceneFile} from '../core/transfer.ts';
import type {World} from '../core/model.ts';
import {listLocalScenes,localSceneBlob,prepareLocalScene,saveLocalScenes} from '../scene/library.ts';
import {DEFAULT_BACKGROUND} from '../scene/defaultBackground.ts';
import {draftRequest as request} from './request.ts';
type Asset={id:string;name:string;type:string};
export function createDraftClient(){
 let known=new Set<string>(),assets:Asset[]=[];
 return{
  async load(){const value=await(await request()).json();if(value.version!==1||!Number.isSafeInteger(value.revision)||!Array.isArray(value.assets))throw Error('Unsupported shared draft.');const world=checkedWorld(value.world);assets=value.assets;known=new Set(assets.map(asset=>asset.id));return{revision:value.revision,world};},
  async restore(world:World){
   const local=new Set((await listLocalScenes()).map(asset=>asset.id));
   for(const id of sceneReferences(world)){
    if(local.has(id)||id===DEFAULT_BACKGROUND.id)continue;
    const asset=assets.find(asset=>asset.id===id);if(!asset)throw Error('Shared image is missing.');
    const response=await request(`?asset=${encodeURIComponent(id)}`),blob=await response.blob();
    const item=await prepareLocalScene(new File([blob],asset.name,{type:asset.type}),null);if(item.id!==id)throw Error('Shared image identity mismatch.');await saveLocalScenes([item]);
   }
  },
  async save(world:World,revision:number){
   const references=[...sceneReferences(world)].filter(id=>!known.has(id));
   if(references.length){const metadata=new Map((await listLocalScenes()).map(asset=>[asset.id,asset]));
    for(const id of references){const asset=metadata.get(id);if(!asset)throw Error('A draft image is missing locally.');const blob=await localSceneBlob(id);const file:SceneFile={id,name:asset.name,type:asset.type,data:encodeBytes(new Uint8Array(await blob.arrayBuffer()))};await request(`?asset=${encodeURIComponent(id)}`,'PUT',file);known.add(id);}
   }
   return (await(await request('','PUT',{version:1,revision,world:checkedWorld(world)})).json()).revision as number;
  },
 };
}
