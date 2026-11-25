import {universalHistory} from '../core/universalHistory.ts';
import {queueImageDeletion,restoreImageDeletions} from '../cloud/imageDeletions.ts';
const slot='omnium.scene.deleted.1';
export type ImageTrashState=Record<string,number>;
export function createImageTrash(storage:Pick<Storage,'getItem'|'setItem'>,history:typeof universalHistory,onRestore:(ids:string[])=>void,onDelete:(id:string)=>void){
 let state:ImageTrashState=JSON.parse(storage.getItem(slot)??'{}');const previous=Object.keys(state);state={};storage.setItem(slot,'{}');
 const listeners=new Set<()=>void>();
 const write=(next:ImageTrashState)=>{storage.setItem(slot,JSON.stringify(next));const restored=Object.keys(state).filter(id=>!(id in next)),removed=Object.keys(next).filter(id=>!(id in state));if(restored.length)onRestore(restored);for(const id of removed)onDelete(id);state=next;for(const fn of listeners)fn();};
 history.register('scene-images',{read:()=>state,write});
 return {previous,has:(id:string)=>id in state,get bytes(){return Object.values(state).reduce((a,b)=>a+b,0);},subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},restore(ids:readonly string[]){if(!ids.some(id=>id in state))return;const next={...state};for(const id of ids)delete next[id];write(next);},remove(id:string,size:number,after?:()=>void){if(state[id]!==undefined)return;if(Object.values(state).reduce((a,b)=>a+b,0)+size>100*1024*1024)throw Error('Image undo storage is full. Reload to finalize earlier deletions.');const before=state;history.transaction(()=>{try{write({...state,[id]:size});history.record('scene-images',before,state,['settings'],['omnium']);after?.();}catch(error){write(before);throw error;}});}};
}
let shared:ReturnType<typeof createImageTrash>|undefined;
export const imageTrash=()=>shared??=createImageTrash(localStorage,universalHistory,restoreImageDeletions,queueImageDeletion);
