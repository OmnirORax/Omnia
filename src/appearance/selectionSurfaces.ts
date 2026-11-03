export type SelectionPoint={x:number;y:number};
export type SelectionBox={left:number;top:number;right:number;bottom:number};
export type SelectionUnit={id:string;box:SelectionBox};
export type SelectionSurface={element:()=>Element|null;context?:()=>string;nativePicking?:boolean;snapshot:()=>{units:readonly SelectionUnit[];valid?:readonly string[];selected:readonly string[];hit:(point:SelectionPoint)=>string|undefined};elements?:(ids:readonly string[])=>readonly Element[];apply:(ids:readonly string[])=>void};
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
  return {
    register(surface:SelectionSurface){const id=`surface-${++sequence}`;surfaces.set(id,surface);return()=>{surfaces.delete(id);for(const key of anchors.keys())if(key.startsWith(`${id}/`))anchors.delete(key);};},
    anchor(element:Element,point:SelectionPoint){const found=find(element);if(!found)return;const hit=found[1].snapshot().hit(point);if(hit)anchors.set(found[0],hit);},
    prepare(element:Element,point:SelectionPoint,mode:'toggle'|'range',nativeOnly=false){
      const found=find(element);if(!found||nativeOnly&&!found[1].nativePicking)return;
      const [id,surface]=found,snapshot=surface.snapshot(),hit=snapshot.hit(point);if(!hit)return;
      const before=[...snapshot.selected],selected=new Set(before);
      if(mode==='toggle'){selected.has(hit)?selected.delete(hit):selected.add(hit);anchors.set(id,hit);}
      else{const anchor=anchors.get(id)??before.at(-1);for(const unit of spatialSelectionRange(snapshot.units,anchor,hit))selected.add(unit);if(!anchor)anchors.set(id,hit);}
      const after=[...selected];return {id,before,after,elements:surface.elements?.(after)};
    },
    apply(id:string,ids:readonly string[]){const base=id.split('/')[0],surface=surfaces.get(base);if(!surface||id!==`${base}/${encodeURIComponent(surface.context?.()??'')}`)return;const snapshot=surface.snapshot(),valid=new Set(snapshot.valid??snapshot.units.map(unit=>unit.id));surface.apply(ids.filter(id=>valid.has(id)));},
  };
}
export const selectionSurfaces=createSelectionSurfaces();
