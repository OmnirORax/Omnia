type Deletion={id:string;token:string};
const key='omnium.shared-draft.deleted-images.1';
const storage=()=>localStorage;
export function pendingImageDeletions(store:Pick<Storage,'getItem'>=storage()):Deletion[]{
 const value=JSON.parse(store.getItem(key)??'[]');
 if(!Array.isArray(value)||value.length>1000||value.some(item=>!item||!/^sha256:[a-f0-9]{64}$/.test(item.id)||typeof item.token!=='string'))throw Error('Shared image deletion records are invalid.');
 return value;
}
export function queueImageDeletion(id:string,store:Pick<Storage,'getItem'|'setItem'>=storage()){
 if(!/^sha256:[a-f0-9]{64}$/.test(id))throw Error('Invalid image deletion.');
 const next=pendingImageDeletions(store).filter(item=>item.id!==id),deletion={id,token:crypto.randomUUID()};next.push(deletion);
 if(next.length>1000)throw Error('Push pending image deletions before deleting more images.');
 store.setItem(key,JSON.stringify(next));
 return deletion;
}
export function acknowledgeImageDeletions(deletions:readonly Deletion[],store:Pick<Storage,'getItem'|'setItem'>=storage()){
 if(!deletions.length)return;
 const tokens=new Map(deletions.map(item=>[item.id,item.token]));
 store.setItem(key,JSON.stringify(pendingImageDeletions(store).filter(item=>tokens.get(item.id)!==item.token)));
}
export function restoreImageDeletions(ids:readonly string[],store:Pick<Storage,'getItem'|'setItem'>=storage()){
 const restored=new Set(ids),pending=pendingImageDeletions(store),next=pending.filter(item=>!restored.has(item.id));
 if(next.length!==pending.length)store.setItem(key,JSON.stringify(next));
}
