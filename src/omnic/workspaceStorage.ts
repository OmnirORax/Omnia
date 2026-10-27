import {validateWorkspace,WORKSPACE_KEY,type OmnicWorkspace} from './workspace.ts';

type Slot='active'|'before-replace';
let database:Promise<IDBDatabase>|undefined;
function open():Promise<IDBDatabase>{
  if(database)return database;
  database=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('omnium-workspaces',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
    request.onerror=()=>reject(Error('Workspace storage could not be opened.'));
    request.onblocked=()=>reject(Error('Close older Omnia tabs to update workspace storage.'));
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=undefined;};resolve(db);};
  }).catch(error=>{database=undefined;throw error;});return database!;
}
const key=(slot:Slot)=>slot==='active'?WORKSPACE_KEY:`${WORKSPACE_KEY}:${slot}`;
const authority=(slot:Slot)=>`${key(slot)}:storage`;
export async function readWorkspaceSlot(slot:Slot='active'):Promise<OmnicWorkspace|null>{
  let preferred:string|null=null;try{preferred=localStorage.getItem(authority(slot));}catch{/* IndexedDB can still be available. */}
  if(preferred==='local'){const text=localStorage.getItem(key(slot));if(text)return validateWorkspace(JSON.parse(text));}
  try{
    const db=await open();const value=await new Promise<unknown>((resolve,reject)=>{const tx=db.transaction('snapshots','readonly'),request=tx.objectStore('snapshots').get(slot);tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error??Error('Workspace read failed.'));});
    if(value!==undefined)return validateWorkspace(value);
    if(preferred!==null)throw Error('The saved workspace slot is missing. Recover a workspace export or backup before resuming autosave.');
  }catch(error){
    // Only fall back when no newer IndexedDB slot can be read. Callers report the
    // failure rather than silently opening a stale legacy atlas.
    if(preferred==='indexeddb')throw error;
    const fallback=localStorage.getItem(key(slot));
    return fallback?validateWorkspace(JSON.parse(fallback)):null;
  }
  const legacy=localStorage.getItem(key(slot));return legacy?validateWorkspace(JSON.parse(legacy)):null;
}
export async function saveWorkspaceSlot(value:OmnicWorkspace,slot:Slot='active'):Promise<void>{
  try{
    const db=await open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,slot);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Workspace save failed.'));});
    try{localStorage.removeItem(key(slot));localStorage.setItem(authority(slot),'indexeddb');}catch{/* IndexedDB remains readable when compatibility storage is unavailable. */}
  }catch(error){
    // Sandboxed/storage-restricted browsers keep a bounded compatibility path.
    try{localStorage.setItem(key(slot),JSON.stringify(value));localStorage.setItem(authority(slot),'local');}catch{throw error;}
  }
}
