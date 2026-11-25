import type {EditorView} from '@codemirror/view';
import {readVisibleFieldSlices} from './fieldPresentation.ts';
import {focusPaletteCSS} from '../properties/focusPalette.ts';
import type {TextPalette} from '../properties/textPalette.ts';
/** One stream across currently visible text; offscreen rows consume no distance. */
export function visibleTextStream(slices:ReturnType<typeof readVisibleFieldSlices>){let total=0;const marks=slices.map(s=>{const width=s.width??0,visible=s.visibleWidth??width,start=total;total+=visible;return {element:s.element,from:s.from,to:s.to,start,end:start+width,width};});return {total,marks};}
export function createStartEndPainter(){let painted=new Set<HTMLElement>();
 const clear=()=>{for(const element of painted)for(const name of ['background-image','background-size','background-position','background-repeat','box-decoration-break','-webkit-box-decoration-break'])element.style.removeProperty(name);painted.clear();};
 return {read(view:EditorView){return visibleTextStream(readVisibleFieldSlices(view));},render(data:{total:number;marks:{element:HTMLElement;start:number;end:number;width:number}[]},palette:TextPalette){clear();const image=focusPaletteCSS(palette,true);for(const {element,start,end,width}of data.marks){const stretch=width/Math.max(.001,end-start);element.style.backgroundImage=image;element.style.backgroundSize=`${Math.max(1,data.total*(palette.scale??1)*stretch)}px 100%`;element.style.backgroundPosition=`${-start*stretch}px 0px`;element.style.backgroundRepeat='repeat-x';element.style.setProperty('box-decoration-break','slice');element.style.setProperty('-webkit-box-decoration-break','slice');painted.add(element);}},clear,invalidate(){}};
}
