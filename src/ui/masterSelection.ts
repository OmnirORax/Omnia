import {createTransientStore} from './transientStore.ts';
export type MasterSelectionChoice={id:string;label:string;symbol?:string;parent?:string};
export type MasterSelectionRequest={label:string;choices:readonly MasterSelectionChoice[];selected?:string;choose:(id:string)=>boolean;cancel:()=>void};
/** One temporary selection consumer in the existing MC; owners retain values. */
export function createMasterSelection(){
 const store=createTransientStore<MasterSelectionRequest|null>(null);
 const cancel=()=>{const request=store.getSnapshot();if(!request)return;store.set(null);request.cancel();};
 return {...store,cancel,
  open(request:MasterSelectionRequest){cancel();store.set(request);return()=>{if(store.getSnapshot()===request)cancel();};},
  choose(id:string){const request=store.getSnapshot();if(!request||!request.choices.some(choice=>choice.id===id)||!request.choose(id))return false;if(store.getSnapshot()===request)store.set(null);return true;},
 };
}
export const masterSelection=createMasterSelection();
