import {sceneReferences,encodeBytes,type WorkspaceFile} from './transfer.ts';
/** Reuse the original image authority for file exports and private cloud saves. */
export async function withWorkspaceImages<T extends WorkspaceFile>(file:T):Promise<T>{
 const {listLocalScenes,localSceneBlob}=await import('../scene/library.ts');
 const references=sceneReferences(file.world),metadata=new Map((references.size?await listLocalScenes():[]).map(item=>[item.id,item]));
 for(const id of references){const item=metadata.get(id);if(!item)throw Error('A scene image is missing. Restore or clear it before exporting.');const blob=await localSceneBlob(id);file.scenes.push({id,name:item.name,type:item.type,data:encodeBytes(new Uint8Array(await blob.arrayBuffer()))});}
 return file;
}
/** Imported backups may use legacy scene aliases. Normalize through the same
 * image validator/identity owner as native imports before reusing cloud bytes. */
export async function prepareWorkspaceImages<T extends WorkspaceFile>(file:T,retainPrepared=true){
 const {prepareLocalScene}=await import('../scene/prepareImage.ts');
 const {decodeScene,rebindScenes}=await import('./transfer.ts');
 const aliases=new Map<string,string>(),scenes=new Map<string,WorkspaceFile['scenes'][number]>(),prepared=new Map<string,import('../scene/library.ts').StoredScene>();
 for(const image of file.scenes){const stored=await prepareLocalScene(new File([decodeScene(image) as Uint8Array<ArrayBuffer>],image.name,{type:image.type}),null);aliases.set(image.id,stored.id);if(retainPrepared)prepared.set(stored.id,stored);if(!scenes.has(stored.id))scenes.set(stored.id,{...image,id:stored.id,type:stored.type});}
 return {file:{...file,world:rebindScenes(file.world,aliases),scenes:[...scenes.values()]},prepared:[...prepared.values()]};
}

export async function canonicalWorkspaceImages<T extends WorkspaceFile>(file:T):Promise<T>{return (await prepareWorkspaceImages(file,false)).file;}
