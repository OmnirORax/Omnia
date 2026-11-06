import {surfaceOwnsInput} from '../ui/inputOwnership.ts';
import { nativeSelectionDragged } from './selectionRequest.ts';
export type SelectionPoint={x:number;y:number};
export type SelectionBox={left:number;top:number;right:number;bottom:number};
export type SelectionUnit={id:string;box:SelectionBox};
export type BaselineSelection={enabled:()=>boolean;pick:(elements:readonly Element[],point:SelectionPoint,intent:'select'|'edit')=>void;cancel:()=>void};
export type SelectionSurface={baseline?:BaselineSelection;element:()=>Element|null;context?:()=>string;nativePicking?:boolean;onStart?:()=>void;onComplete?:(ids:readonly string[],point:SelectionPoint)=>void;snapshot:()=>{units:readonly SelectionUnit[];valid?:readonly string[];selected:readonly string[];elements?:(ids:readonly string[])=>readonly Element[];area?:(start:SelectionPoint,end:SelectionPoint)=>readonly string[];hit:(point:SelectionPoint)=>string|undefined};elements?:(ids:readonly string[])=>readonly Element[];apply:(ids:readonly string[])=>void};
/** Native modifiers belong to selection before an editing tool can replace it. */
export function selectionPointerMode(event:{button:number;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;altKey:boolean}):'toggle'|'range'|undefined {
  if(event.button!==0||event.altKey)return;
  return event.shiftKey?'range':event.ctrlKey||event.metaKey?'toggle':undefined;
}
export function spatialSelectionRange(units:readonly SelectionUnit[],anchor:string|undefined,end:string){
  const last=units.find(unit=>unit.id===end),first=units.find(unit=>unit.id===anchor);
  if(!last)return [];
  if(!first||first.id===last.id)return [last.id];
  const center=(box:SelectionBox)=>({x:(box.left+box.right)/2,y:(box.top+box.bottom)/2});
  const a=center(first.box),b=center(last.box),area={left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
  return units.filter(unit=>unit.id===first.id||unit.id===last.id||unit.box.left<=area.right&&unit.box.right>=area.left&&unit.box.top<=area.bottom&&unit.box.bottom>=area.top).map(unit=>unit.id);
}
/** Renderer adapters supply identities, hit testing and projected bounds. MS owns
 * commands/history; the adapter never implements keyboard or selection policy. */
export function createSelectionSurfaces(){
  let sequence=0;const surfaces=new Map<string,SelectionSurface>(),anchors=new Map<string,string>();
  const find=(element:Element,path:readonly EventTarget[]=[])=>{const found=[...surfaces].reverse().find(([,surface])=>{const root=surface.element();return !!root&&surfaceOwnsInput(root,element,path);});return found?[`${found[0]}/${encodeURIComponent(found[1].context?.()??'')}`,found[1]] as const:undefined;};
  const current=(id:string)=>{const surface=surfaces.get(id.split('/')[0]);return surface&&id===`${id.split('/')[0]}/${encodeURIComponent(surface.context?.()??'')}`?surface:undefined;};
  const prepare=(element:Element,point:SelectionPoint,mode:'toggle'|'range'|'area',nativeOnly=false,end=point)=>{
    const found=find(element);if(!found||nativeOnly&&!found[1].nativePicking)return;
    const [id,surface]=found;return prepareSnapshot(id,surface,surface.snapshot(),point,mode,end);
  };
  const prepareSnapshot=(id:string,surface:SelectionSurface,snapshot:ReturnType<SelectionSurface['snapshot']>,point:SelectionPoint,mode:'toggle'|'range'|'area',end:SelectionPoint,commitAnchor=true)=>{
    const hit=snapshot.hit(point);if(!hit&&mode!=='area')return;
    const before=[...snapshot.selected],selected=new Set(before);
    const anchor=(value:string)=>{if(commitAnchor)anchors.set(id,value);};
    if(mode==='toggle'){selected.has(hit!)?selected.delete(hit!):selected.add(hit!);anchor(hit!);}
    else if(mode==='range'){const from=anchors.get(id)??before.at(-1);for(const unit of spatialSelectionRange(snapshot.units,from,hit!))selected.add(unit);if(!from)anchor(hit!);}
    else if(snapshot.area){for(const unit of snapshot.area(point,end))selected.add(unit);if(hit)anchor(hit);}
    else {const box={left:Math.min(point.x,end.x),right:Math.max(point.x,end.x),top:Math.min(point.y,end.y),bottom:Math.max(point.y,end.y)};for(const unit of snapshot.units)if(unit.box.left<=box.right&&unit.box.right>=box.left&&unit.box.top<=box.bottom&&unit.box.bottom>=box.top)selected.add(unit.id);if(hit)anchor(hit);}
    const after=[...selected];return {id,before,after,elements:(snapshot.elements??(commitAnchor?surface.elements:undefined))?.(after),units:snapshot.units.filter(unit=>selected.has(unit.id))};
  };
  let globalSession=false;
  let session:{id:string;surface:SelectionSurface;root:Element}|undefined;
  const sessionOwns=(element:Element,path:readonly EventTarget[]=[])=>session?current(session.id)===session.surface&&session.surface.element()===session.root&&surfaceOwnsInput(session.root,element,path):globalSession;
  return {
    baseline(element:Element){const found=find(element);return found?.[1].baseline?.enabled()?found[1].baseline:undefined;},
    beginSession(element?:Element){
      const found=element&&(find(element)??[...surfaces].reverse().flatMap(([key,surface])=>{const root=surface.element();return root?.closest?.('[data-selection-context]')?.contains(element)?[[`${key}/${encodeURIComponent(surface.context?.()??'')}`,surface] as const]:[];})[0]);
      const root=found?.[1].element();session=found&&root?{id:found[0],surface:found[1],root}:undefined;globalSession=!session;
    },
    endSession(){session=undefined;globalSession=false;},sessionOwns,
    sessionScoped:()=>!!session,
    register(surface:SelectionSurface){const id=`surface-${++sequence}`;surfaces.set(id,surface);return()=>{surfaces.delete(id);for(const key of anchors.keys())if(key.startsWith(`${id}/`))anchors.delete(key);};},
    anchor(element:Element,point:SelectionPoint){const found=find(element);if(!found)return;const hit=found[1].snapshot().hit(point);if(hit)anchors.set(found[0],hit);},
    prepare,
    /** Retain surface/context and delay membership until release. Native tools
     * never receive this press, its drag, or its trailing click. */
    beginPointer(element:Element,start:SelectionPoint,mode:'toggle'|'range',path:readonly EventTarget[]=[]){
      const found=find(element,path);if(!found)return;const id=found[0],root=found[1].element();found[1].onStart?.();
      const valid=()=>!!root&&found[1].element()===root&&!!current(id);
      let dragged=false;
      const finish=(end:SelectionPoint)=>valid()?prepare(root!,start,dragged||nativeSelectionDragged(start,end)?'area':mode,false,end):undefined;
      let snapshot:ReturnType<SelectionSurface['snapshot']>|undefined;
      return Object.assign(finish,{preview:(end:SelectionPoint)=>{
        if(!valid()||!dragged&&!nativeSelectionDragged(start,end))return;
        dragged=true;
        if(!snapshot){
          snapshot=found[1].snapshot();
        }
        return prepareSnapshot(id,found[1],snapshot,start,'area',end,false);
      }});
    },
    complete(id:string,ids:readonly string[],point:SelectionPoint){current(id)?.onComplete?.(ids,point);},
    apply(id:string,ids:readonly string[]){const surface=current(id);if(!surface)return;const snapshot=surface.snapshot(),valid=new Set(snapshot.valid??snapshot.units.map(unit=>unit.id));surface.apply(ids.filter(id=>valid.has(id)));},
  };
}
export const selectionSurfaces=createSelectionSurfaces();
