import {checkedTransferParts,type PartsFile} from '../core/transferParts.ts';
import {checkedWorld,sceneReferences} from '../core/transfer.ts';
import type {World} from '../core/model.ts';
export type PrivateSnapshot={format:'omnium-v2-private-workspace';version:1;world:World;images:{sceneId:string;assetId:string}[];parts?:PartsFile['parts']};
export type PrivateWorkspace={workspace_id:string;revision:number;snapshot:PrivateSnapshot;request_id:string;updated_by:string;updated_at:string};
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function privateSnapshot(value:unknown):PrivateSnapshot{
 const input=value as PrivateSnapshot;
 if(!input||input.format!=='omnium-v2-private-workspace'||input.version!==1||!Array.isArray(input.images)||input.images.length>100)throw Error('Unsupported private workspace snapshot.');
 const world=checkedWorld(input.world),required=sceneReferences(world),seen=new Set<string>();
 for(const image of input.images){if(!image||typeof image.sceneId!=='string'||!required.has(image.sceneId)||seen.has(image.sceneId)||typeof image.assetId!=='string'||!UUID.test(image.assetId))throw Error('Invalid private scene reference.');seen.add(image.sceneId);}
 if(seen.size!==required.size)throw Error('Private workspace is missing scene images.');
 return {format:input.format,version:1,world,...(input.parts!==undefined?{parts:checkedTransferParts(world,input.parts)}:{}),images:input.images.map(image=>({sceneId:image.sceneId,assetId:image.assetId}))};
}
