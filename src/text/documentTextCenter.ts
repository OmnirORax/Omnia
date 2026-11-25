import type {EditorView} from '@codemirror/view';
import {observeDocumentViewport} from './documentViewport.ts';
import {mergeVisibleTextBounds,visibleTextCenter,type ScreenTextBounds} from './visibleTextCenter.ts';

function visibleDocumentText(view:EditorView){
 const width=window.innerWidth,height=window.innerHeight;
 if(!width||!height)return;
 const clip=view.scrollDOM.getBoundingClientRect(),range=document.createRange();
 let found:ScreenTextBounds|undefined;
 for(const line of view.contentDOM.querySelectorAll<HTMLElement>('.cm-line')){
  if(!line.textContent?.trim()&&!line.querySelector('img, svg, canvas'))continue;
  range.selectNodeContents(line);
  for(const rect of range.getClientRects())found=mergeVisibleTextBounds(found,{
   left:Math.max(rect.left,clip.left)/width,top:Math.max(rect.top,clip.top)/height,
   right:Math.min(rect.right,clip.right)/width,bottom:Math.min(rect.bottom,clip.bottom)/height,
  });
 }
 return found;
}

export function observeDocumentTextCenter(view:EditorView){
 const key={};
 let pending=false,closed=false,stopViewport:(()=>void)|undefined;
 function refresh(){
  if(closed||pending||!visibleTextCenter.enabled||!view.dom.isConnected)return;
  pending=true;
  view.requestMeasure({key,read:view=>!closed&&visibleTextCenter.enabled?visibleDocumentText(view):undefined,write:bounds=>{
   pending=false;if(!closed)visibleTextCenter.updateDocument(key,bounds);
  }});
 }
 function demand(){
  if(visibleTextCenter.enabled){stopViewport??=observeDocumentViewport(view,refresh);refresh();}
  else {stopViewport?.();stopViewport=undefined;}
 }
 const stopDemand=visibleTextCenter.onDemand(demand);
 demand();
 return {refresh,dispose(){closed=true;stopDemand();stopViewport?.();visibleTextCenter.updateDocument(key);}};
}
