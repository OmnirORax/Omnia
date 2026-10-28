import {canDock,ownerOf,residentContextScope,residentPinned,type UILayout} from './layout.ts';
/** Read-only gesture projection. Never use with a layout being mutated in place.
 * A new committed/default-expanded snapshot invalidates all permission results. */
export function createDragQueries(){
  let snapshot:UILayout|undefined;
  const owners=new Map<string,string|undefined>(),pins=new Map<string,boolean>(),scopes=new Map<string,string|undefined>(),docks=new Map<string,Map<string,boolean>>();
  const use=(layout:UILayout)=>{
    if(snapshot===layout)return;
    snapshot=layout;owners.clear();pins.clear();scopes.clear();docks.clear();
  };
  return {
    ownerOf(layout:UILayout,key:string){use(layout);if(!owners.has(key))owners.set(key,ownerOf(layout,key));return owners.get(key);},
    residentPinned(layout:UILayout,key:string){use(layout);if(!pins.has(key))pins.set(key,residentPinned(layout,key));return pins.get(key)!;},
    residentContextScope(layout:UILayout,key:string){use(layout);if(!scopes.has(key))scopes.set(key,residentContextScope(layout,key));return scopes.get(key);},
    canDock(layout:UILayout,key:string,target:string){
      use(layout);let targets=docks.get(key);if(!targets){targets=new Map();docks.set(key,targets);}
      if(!targets.has(target))targets.set(target,canDock(layout,key,target));return targets.get(target)!;
    },
  };
}
