import {cloud,type Asset} from './cloud.ts';
import type {SceneStorage,SceneImage} from '../scene/storage.ts';
import type {WorkspaceContext} from './workspaceContext.ts';
export function privateSceneStorage(context:WorkspaceContext):SceneStorage{
 const {id,canWrite,session}=context.state,valid=context.current(),client=context.client;
 let assets=new Map<string,Asset>();
 const requireAccess=(write=false)=>{if(!valid())throw Error('Account workspace changed.');if(write&&!canWrite)throw Error('Workspace is read-only.');};
 const asset=(image:SceneImage)=>{const found=assets.get(image.id);if(!found)throw Error('Image no longer available.');return found;};
 return {key:`account:${id}`,current:valid,writable:()=>valid()&&canWrite,canFinalize:image=>valid()&&canWrite&&image.created_by===session?.user.id,
  async list(){requireAccess();const list=await cloud.assets(client,id);if(!valid())return [];assets=new Map(list.map(item=>[item.id,item]));return list;},
  async upload(file,input){requireAccess(true);const {importLocalScene}=await import('../scene/library.ts'),local=await importLocalScene(file,input);requireAccess(true);const image=await cloud.upload(client,id,file,crypto.randomUUID(),valid);assets.set(image.id,image);return {...image,localId:local.id};},
  download:image=>{requireAccess();return cloud.download(client,asset(image));},remove:image=>{requireAccess(true);return cloud.remove(client,asset(image).id);},finalize:image=>{requireAccess(true);return cloud.finalize(client,asset(image).id);},
 };
}
