import type {EditorView} from '@codemirror/view';
import {textSlices} from './textSlices.ts';
import {observeDocumentViewport} from './documentViewport.ts';

type PixelLayout={
 point:{left:number;top:number};
 cuts:number[];
 runs:{element:HTMLElement;x:number;y:number}[];
};

export function createDocumentPixelPainter(){
 let painted=new Set<HTMLElement>(),activeView:EditorView|undefined,stopPosition: (()=>void)|undefined;
 const origin=(view:EditorView)=>{
  const {left,top}=view.contentDOM.getBoundingClientRect();
  return {left,top};
 };
 const updateOrigin=(view:EditorView,{left,top}:ReturnType<typeof origin>)=>{
  view.contentDOM.style.setProperty('--document-image-x',`${-left}px`);
  view.contentDOM.style.setProperty('--document-image-y',`${-top}px`);
 };
 const unpaint=(element:HTMLElement)=>{
  element.removeAttribute('data-image-pixel-position');
  element.style.removeProperty('--image-pixel-x');
  element.style.removeProperty('--image-pixel-y');
 };
 return {
  watch(view:EditorView){
   if(activeView===view)return;
   activeView=view;
   const refresh=()=>view.requestMeasure({key:origin,read:origin,write:(point,view)=>{if(activeView===view)updateOrigin(view,point);}});
   stopPosition=observeDocumentViewport(view,refresh);
  },
  read(view:EditorView):PixelLayout{
   const point=origin(view),cuts:PixelLayout['cuts']=[],runs:PixelLayout['runs']=[];
   for(const element of view.contentDOM.querySelectorAll<HTMLElement>('.cm-image-palette')){
    const rects=element.getClientRects();
    if(rects.length>1){
     for(const part of textSlices(element))cuts.push(view.posAtDOM(part.node,part.from),view.posAtDOM(part.node,part.to));
    }
    const rect=rects[0];
    if(rect)runs.push({element,x:point.left-rect.left,y:point.top-rect.top});
   }
   return {point,cuts,runs};
  },
  render(view:EditorView,{point,runs}:PixelLayout){
   updateOrigin(view,point);
   const next=new Set<HTMLElement>();
   for(const {element,x,y} of runs){
    element.style.setProperty('--image-pixel-x',`${x}px`);
    element.style.setProperty('--image-pixel-y',`${y}px`);
    element.setAttribute('data-image-pixel-position','');
    next.add(element);
   }
   for(const element of painted)if(!next.has(element))unpaint(element);
   painted=next;
  },
  clear(){
   stopPosition?.();stopPosition=undefined;
   activeView?.contentDOM.style.removeProperty('--document-image-x');
   activeView?.contentDOM.style.removeProperty('--document-image-y');
   activeView=undefined;
   for(const element of painted)unpaint(element);
   painted.clear();
  },
 };
}
