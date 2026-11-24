import {canonicalWorkspaceImages} from '../core/workspaceImages.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
import {accountRequest} from './request.ts';
import {privateSnapshot,type PrivateWorkspace,type PrivateSnapshot} from './workspaceSnapshot.ts';
import {parseWorkspaceFile,encodeBytes,decodeScene,type WorkspaceFile} from '../core/transfer.ts';
import {cloud} from './cloud.ts';
import {parsePartsFile} from '../core/transferParts.ts';
export async function loadPrivateWorkspace(client:SupabaseClient,id:string):Promise<PrivateWorkspace|null>{
 const response=await client.from('omnium_account_workspaces').select('*').eq('workspace_id',id).maybeSingle();if(response.error)throw Error('Private workspace could not be loaded.');if(!response.data)return null;
 return {...response.data,snapshot:privateSnapshot(response.data.snapshot)};
}
export async function savePrivateWorkspace(client:SupabaseClient,id:string,backup:WorkspaceFile,expected:PrivateWorkspace|null,requestId:string,current:()=>boolean=()=>true):Promise<PrivateWorkspace>{
 if(!current())throw Error('Account changed.');const validated=await canonicalWorkspaceImages(parsePartsFile(JSON.stringify(backup))),assets=expected?.snapshot.images.length?await cloud.assets(client,id,expected.snapshot.images.map(image=>image.assetId)):[],images:PrivateSnapshot['images']=[];
 if(!current())throw Error('Account changed.');for(const image of validated.scenes){
  if(!current())throw Error('Account changed.');
  const previous=expected?.snapshot.images.find(item=>item.sceneId===image.id);let asset=previous&&assets.find(asset=>asset.id===previous.assetId&&asset.state==='ready');
  if(!asset)asset=await cloud.upload(client,id,new File([decodeScene(image) as Uint8Array<ArrayBuffer>],image.name,{type:image.type}),crypto.randomUUID(),current);
  images.push({sceneId:image.id,assetId:asset.id});
 }
 const snapshot=privateSnapshot({format:'omnium-v2-private-workspace',version:1,world:validated.world,images,...(validated.parts!==undefined?{parts:validated.parts}:{})});
 return accountRequest<PrivateWorkspace>(client,'account-workspace',{workspaceId:id,expectedVersion:expected?.revision??0,requestId,snapshot},current);
}
export async function downloadPrivateWorkspace(client:SupabaseClient,id:string):Promise<WorkspaceFile>{
 const saved=await loadPrivateWorkspace(client,id);if(!saved)throw Error('This cloud workspace has no V2 backup yet.');
 const assets=await cloud.assets(client,id,saved.snapshot.images.map(image=>image.assetId)),scenes:WorkspaceFile['scenes']=[];
 for(const image of saved.snapshot.images){const asset=assets.find(asset=>asset.id===image.assetId&&asset.state==='ready');if(!asset)throw Error('A private scene image is missing.');const blob=await cloud.download(client,asset);scenes.push({id:image.sceneId,name:asset.name,type:asset.media_type,data:encodeBytes(new Uint8Array(await blob.arrayBuffer()))});}
 return parseWorkspaceFile(JSON.stringify({format:'omnium-v2-workspace',version:1,world:saved.snapshot.world,scenes,...(saved.snapshot.parts!==undefined?{parts:saved.snapshot.parts}:{})}));
}
