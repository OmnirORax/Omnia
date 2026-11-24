import {scanInk,paintInkScan,type InkScan} from '../properties/inkProgression.ts';
import {focusRatio} from '../properties/focusPalette.ts';
import type {TextPalette} from '../properties/textPalette.ts';
import {reportSystemMessage} from '../ui/systemMessage.ts';
const canvasFont=(style:CSSStyleDeclaration)=>style.font||`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
const PIXEL_BUDGET=2_000_000,EDGE_LIMIT=16384;
type Fragment={text:string;font:string;spacing:string;wordSpacing:string;width:number;height:number;ascent:number;descent:number;stroke:number};
type Mark={element:HTMLElement;start:number;ascent:number};
type Row={key:string;fragments:Fragment[];marks:Mark[];width:number;height:number;ascent:number};
/** Geometry reads are separate from raster writes. Inline slices share one unwrapped ink stream. */
export function readInkRows(root:HTMLElement){
 const groups=new Map<Element,Row>(),range=document.createRange(),measure=document.createElement('canvas').getContext('2d')!;
 for(const element of root.querySelectorAll<HTMLElement>('.cm-image-palette')){
  const line=element.closest('.cm-line')??element;let row=groups.get(line);if(!row){row={key:'',fragments:[],marks:[],width:0,height:0,ascent:0};groups.set(line,row);}
  const markStyle=getComputedStyle(element);measure.font=canvasFont(markStyle);const markMetrics=measure.measureText('Mg');row.marks.push({element,start:row.width,ascent:markMetrics.fontBoundingBoxAscent??parseFloat(markStyle.fontSize)});
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node:Node|null;
  while((node=walker.nextNode())){const text=node.textContent??'';if(!text)continue;const style=getComputedStyle(node.parentElement!);measure.font=canvasFont(style);const metrics=measure.measureText('Mg'),ascent=metrics.fontBoundingBoxAscent??parseFloat(style.fontSize),descent=metrics.fontBoundingBoxDescent??parseFloat(style.fontSize)*.25;let from=0;
   while(from<text.length){range.setStart(node,from);range.setEnd(node,text.length);let to=text.length;
    if(range.getClientRects().length>1){let low=from+1,high=text.length;while(low<high){const mid=Math.ceil((low+high)/2);range.setEnd(node,mid);if(range.getClientRects().length<=1)low=mid;else high=mid-1;}to=low;range.setEnd(node,to);}
    const rect=range.getBoundingClientRect(),fragment={text:text.slice(from,to),font:canvasFont(style),spacing:style.letterSpacing,wordSpacing:style.wordSpacing,width:rect.width,height:rect.height,ascent,descent,stroke:parseFloat(style.webkitTextStrokeWidth)||0};row.fragments.push(fragment);row.width+=rect.width;row.ascent=Math.max(row.ascent,ascent);row.height=Math.max(row.height,ascent+descent,rect.height);from=to;
   }
  }
 }
 for(const row of groups.values()){row.width=Math.max(1,Math.ceil(row.width));row.height=Math.max(1,Math.ceil(row.height));row.key=JSON.stringify([row.fragments,row.width,row.height,row.ascent]);}return [...groups.values()];
}
const clear=(element:HTMLElement)=>{for(const name of ['background-image','background-size','background-position','background-repeat','filter','box-decoration-break','-webkit-box-decoration-break'])element.style.removeProperty(name);};
export function createInkTextPainter(){
 let cache=new Map<string,{scan:InkScan;paintKey?:string;url?:string}>(),painted=new Set<HTMLElement>(),warned='';
 return {render(rows:Row[],palette:TextPalette){const next=new Map<string,{scan:InkScan;paintKey?:string;url?:string}>(),elements=new Set<HTMLElement>();let pixels=0;const paintKey=JSON.stringify([palette.colors.length,focusRatio(palette),palette.distribution,palette.scale]);
  for(const row of rows){const count=row.width*row.height;if(row.width>EDGE_LIMIT||row.height>EDGE_LIMIT||pixels+count>PIXEL_BUDGET){if(warned!==row.key){warned=row.key;reportSystemMessage('Ink serpentine reached the visible text scan limit. Shorten the long line or use Horizontal.');}continue;}pixels+=count;
   let entry=cache.get(row.key);let canvas:HTMLCanvasElement|undefined,ctx:CanvasRenderingContext2D|undefined;const context=()=>{if(ctx)return ctx;canvas=document.createElement('canvas');canvas.width=row.width;canvas.height=row.height;return ctx=canvas.getContext('2d',{willReadFrequently:true})!;};
   if(!entry){const ctx=context();ctx.textBaseline='alphabetic';ctx.fillStyle='#fff';let x=0;for(const fragment of row.fragments){ctx.font=fragment.font;ctx.letterSpacing=fragment.spacing==='normal'?'0px':fragment.spacing;ctx.wordSpacing=fragment.wordSpacing==='normal'?'0px':fragment.wordSpacing;if(fragment.stroke){ctx.strokeStyle='#fff';ctx.lineWidth=fragment.stroke;ctx.strokeText(fragment.text,x,row.ascent);}ctx.fillText(fragment.text,x,row.ascent);x+=fragment.width;}entry={scan:scanInk(row.width,row.height,ctx.getImageData(0,0,row.width,row.height).data)};}
   if(entry.paintKey!==paintKey){const ctx=context(),image=ctx.createImageData(row.width,row.height);image.data.set(paintInkScan(entry.scan,palette,true));ctx.putImageData(image,0,0);entry.url=`url("${canvas!.toDataURL('image/png')}")`;entry.paintKey=paintKey;}
   next.set(row.key,entry);for(const mark of row.marks){elements.add(mark.element);mark.element.style.backgroundImage=entry.url!;mark.element.style.filter='var(--document-ink-filter,none)';mark.element.style.backgroundSize=`${row.width}px ${row.height}px`;mark.element.style.backgroundPosition=`${-mark.start}px ${mark.ascent-row.ascent}px`;mark.element.style.backgroundRepeat='no-repeat';mark.element.style.setProperty('box-decoration-break','slice');mark.element.style.setProperty('-webkit-box-decoration-break','slice');}
  }
  for(const element of painted)if(!elements.has(element))clear(element);painted=elements;cache=next;
 },invalidate(){cache.clear();},clear(){for(const element of painted)clear(element);painted.clear();cache.clear();}};
}
