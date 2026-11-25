import type {EditorView} from '@codemirror/view';
import type {TextPalette} from '../properties/textPalette.ts';
import {focusPaletteCSS,focusPaletteGeometry,isFittedField} from '../properties/focusPalette.ts';
import {textSlices} from './textSlices.ts';
export type FieldSlice={element:HTMLElement;from:number;to:number;x:number;y:number;width?:number;visibleWidth?:number;bounds?:{width:number;height:number}};
type VisibleSlice={element:HTMLElement;from:number;to:number;left:number;top:number;right:number;bottom:number};
/** One shared fit over currently visible text, compacting gaps between occupied rows. */
export function visibleFieldSlices(parts:VisibleSlice[],clip:{left:number;top:number;right:number;bottom:number}):FieldSlice[]{
 const visible=parts.filter(p=>p.right>clip.left&&p.left<clip.right&&p.bottom>clip.top&&p.top<clip.bottom);if(!visible.length)return [];
 const rows:{top:number;bottom:number;packed:number}[]=[];for(const p of [...visible].sort((a,b)=>a.top-b.top)){const top=Math.max(clip.top,p.top),bottom=Math.min(clip.bottom,p.bottom),last=rows.at(-1);if(last&&top<last.bottom-.5)last.bottom=Math.max(last.bottom,bottom);else rows.push({top,bottom,packed:0});}
 let height=0;for(const row of rows){row.packed=height;height+=row.bottom-row.top;}
 const left=Math.max(clip.left,Math.min(...visible.map(p=>p.left))),right=Math.min(clip.right,Math.max(...visible.map(p=>p.right))),bounds={width:Math.max(1,right-left),height:Math.max(1,height)};
 return visible.map(p=>{const row=rows.find(r=>p.bottom>r.top&&p.top<r.bottom)!;return {element:p.element,from:p.from,to:p.to,width:p.right-p.left,visibleWidth:Math.min(clip.right,p.right)-Math.max(clip.left,p.left),x:p.left-left,y:p.top-row.top+row.packed,bounds};});
}
export function readVisibleFieldSlices(view:EditorView){const clip=view.scrollDOM.getBoundingClientRect(),win=view.dom.ownerDocument.defaultView,parts:VisibleSlice[]=[];
  for(const element of view.dom.querySelectorAll<HTMLElement>('.cm-image-palette'))for(const part of textSlices(element)){if(!part.text.trim()||part.rect.width<=0)continue;parts.push({element,from:view.posAtDOM(part.node,part.from),to:view.posAtDOM(part.node,part.to),left:part.rect.left,top:part.rect.top,right:part.rect.left+part.rect.width,bottom:part.rect.top+part.rect.height});}
  return visibleFieldSlices(parts,{left:Math.max(0,clip.left),top:Math.max(0,clip.top),right:Math.min(win?.innerWidth??Infinity,clip.right),bottom:Math.min(win?.innerHeight??Infinity,clip.bottom)});
}
export function createDocumentFieldPainter(){let painted=new Set<HTMLElement>();
 const clear=()=>{for(const element of painted)for(const name of ['background-image','background-size','background-position','background-repeat','filter','box-decoration-break','-webkit-box-decoration-break'])element.style.removeProperty(name);painted.clear();};
 return {read:readVisibleFieldSlices,render(slices:FieldSlice[],palette:TextPalette){clear();const image=focusPaletteCSS(palette),geometry=focusPaletteGeometry(palette);for(const {element,x,y,bounds}of slices){element.style.backgroundImage=image;element.style.backgroundSize=isFittedField(palette)&&bounds?`${bounds.width}px ${Math.max(1,bounds.height)}px`:geometry.size;element.style.backgroundPosition=`${-x}px ${-y}px`;element.style.backgroundRepeat=geometry.repeat;element.style.filter='var(--document-palette-filter,none)';element.style.setProperty('box-decoration-break','clone');element.style.setProperty('-webkit-box-decoration-break','clone');painted.add(element);}},clear,invalidate(){}};
}
