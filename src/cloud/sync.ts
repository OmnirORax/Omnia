import type {World} from '../core/model.ts';
export type Draft={revision:number;world:World};
export type DraftPhase='Loading'|'Saving'|'Saved'|'Failed'|'Conflict'|'Published';
export type Marker={revision:number;signature:string};
export const signature=async(world:World)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(world,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)))),n=>n.toString(16).padStart(2,'0')).join('');
/** One in-flight save, optimistic revisions, and local recovery instead of blind overwrites. */
export function createDraftSync(host:{read:()=>World;replace:(world:World)=>Promise<void>;load:()=>Promise<Draft>;save:(world:World,revision:number)=>Promise<number>;marker:()=>Marker|null;remember:(marker:Marker)=>void;hasLocal:boolean;autoLoad:boolean;status:(phase:DraftPhase,error?:string)=>void}){
 let fresh=!host.hasLocal,phase:DraftPhase='Loading',revision=0,ready=false,applying=false,busy=false,dirty=false,closed=false,timer:ReturnType<typeof setTimeout>|undefined;
 const status=(next:DraftPhase,error?:string)=>{phase=next;host.status(next,error);};
 const remember=async(world:World)=>host.remember({revision,signature:await signature(world)});
 const cancel=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;};
 function changed(){
  if(applying||closed)return;fresh=false;dirty=true;
  if(phase==='Published'){status('Conflict');return;}
  if(ready&&!busy&&timer===undefined){status('Saving');timer=setTimeout(()=>{timer=undefined;void save();},1500);}
 }
 async function save(){
  if(!ready||busy||!dirty||closed)return;cancel();busy=true;dirty=false;status('Saving');const world=host.read();
  try{revision=await host.save(world,revision);await remember(world);if(!closed)status('Saved');}
  catch(error){dirty=true;ready=false;status(error instanceof Error&&error.message==='Conflict'?'Conflict':'Failed',error instanceof Error?error.message:String(error));}
  finally{busy=false;if(dirty&&ready)changed();}
 }
 async function load(choice?:'remote'|'local'){
  if(busy||closed)return;cancel();busy=true;ready=false;status('Loading');const before=host.read();
  try{
   const remote=await host.load(),localHash=await signature(before),remoteHash=await signature(remote.world),marker=host.marker();revision=remote.revision;
   if(closed)return;
   if(host.read()!==before){status('Conflict');return;}
   if(choice==='local'){fresh=false;ready=true;dirty=true;}
   else if(choice==='remote'||localHash===remoteHash||(host.autoLoad&&(fresh||marker?.signature===localHash))){
    if(localHash!==remoteHash){applying=true;try{await host.replace(remote.world);}finally{applying=false;}}
    await remember(host.read());fresh=false;dirty=false;ready=true;status('Saved');
   }else if(marker?.revision===revision&&host.autoLoad){ready=true;dirty=true;}
   else status(host.autoLoad?'Conflict':'Published');
  }catch(error){status('Failed',error instanceof Error?error.message:String(error));}
  finally{busy=false;if(ready&&dirty)changed();}
 }
 return{changed,load,save,dispose(){closed=true;cancel();},get phase(){return phase;}};
}
