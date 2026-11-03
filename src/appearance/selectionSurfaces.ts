import { nativeSelectionDragged } from './selectionRequest.ts';
export type SelectionPoint={x:number;y:number};
export type SelectionBox={left:number;top:number;right:number;bottom:number};
export type SelectionUnit={id:string;box:SelectionBox};
export type SelectionSurface={element:()=>Element|null;context?:()=>string;nativePicking?:boolean;onStart?:()=>void;snapshot:()=>{units:readonly SelectionUnit[];valid?:readonly string[];selected:readonly string[];area?:(start:SelectionPoint,end:SelectionPoint)=>readonly string[];hit:(point:SelectionPoint)=>string|undefined};elements?:(ids:readonly string[])=>readonly Element[];apply:(ids:readonly string[])=>void};
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
  const find=(element:Element)=>{const found=[...surfaces].reverse().find(([,surface])=>{const root=surface.element();return root===element||root?.contains(element);});return found?[`${found[0]}/${encodeURIComponent(found[1].context?.()??'')}`,found[1]] as const:undefined;};
  const prepare=(element:Element,point:SelectionPoint,mode:'toggle'|'range'|'area',nativeOnly=false,end=point)=>{
    const found=find(element);if(!found||nativeOnly&&!found[1].nativePicking)return;
    const [id,surface]=found,snapshot=surface.snapshot(),hit=snapshot.hit(point);if(!hit&&mode!=='area')return;
    const before=[...snapshot.selected],selected=new Set(before);
    if(mode==='toggle'){selected.has(hit!)?selected.delete(hit!):selected.add(hit!);anchors.set(id,hit!);}
    else if(mode==='range'){const anchor=anchors.get(id)??before.at(-1);for(const unit of spatialSelectionRange(snapshot.units,anchor,hit!))selected.add(unit);if(!anchor)anchors.set(id,hit!);}
    else if(snapshot.area){for(const unit of snapshot.area(point,end))selected.add(unit);if(hit)anchors.set(id,hit);}
    else {const box={left:Math.min(point.x,end.x),right:Math.max(point.x,end.x),top:Math.min(point.y,end.y),bottom:Math.max(point.y,end.y)};for(const unit of snapshot.units)if(unit.box.left<=box.right&&unit.box.right>=box.left&&unit.box.top<=box.bottom&&unit.box.bottom>=box.top)selected.add(unit.id);if(hit)anchors.set(id,hit);}
    const after=[...selected];return {id,before,after,elements:surface.elements?.(after)};
  };
  return {
    register(surface:SelectionSurface){const id=`surface-${++sequence}`;surfaces.set(id,surface);return()=>{surfaces.delete(id);for(const key of anchors.keys())if(key.startsWith(`${id}/`))anchors.delete(key);};},
    anchor(element:Element,point:SelectionPoint){const found=find(element);if(!found)return;const hit=found[1].snapshot().hit(point);if(hit)anchors.set(found[0],hit);},
    prepare,
    /** Retain surface/context and delay membership until release. Native tools
     * never receive this press, its drag, or its trailing click. */
    beginPointer(element:Element,start:SelectionPoint,mode:'toggle'|'range'){
      const found=find(element);if(!found)return;const id=found[0];found[1].onStart?.();
      return (end:SelectionPoint)=>find(element)?.[0]===id?prepare(element,start,nativeSelectionDragged(start,end)?'area':mode,false,end):undefined;
    },
    apply(id:string,ids:readonly string[]){const base=id.split('/')[0],surface=surfaces.get(base);if(!surface||id!==`${base}/${encodeURIComponent(surface.context?.()??'')}`)return;const snapshot=surface.snapshot(),valid=new Set(snapshot.valid??snapshot.units.map(unit=>unit.id));surface.apply(ids.filter(id=>valid.has(id)));},
  };
}
export const selectionSurfaces=createSelectionSurfaces();
