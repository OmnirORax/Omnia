import type {MotifRect} from '../properties/pixelMotifs.ts';
import {panel} from '../ui/panel.ts';

export async function openMotifCropPicker(blob:Blob,initial:MotifRect|undefined,active:()=>boolean,commit:(rect:MotifRect)=>void,closed:()=>void){
 const url=URL.createObjectURL(blob),image=new Image();
 image.src=url;
 try{await image.decode();}catch(error){URL.revokeObjectURL(url);throw error;}
 if(!active()){URL.revokeObjectURL(url);return;}
 const view=panel('Motif crop',()=>{image.removeAttribute('src');URL.revokeObjectURL(url);closed();});
 const area=document.createElement('div'),outline=document.createElement('div'),apply=document.createElement('button');
 view.root.classList.add('motif-crop-panel');
 area.className='motif-crop-area';outline.className='motif-crop-selection';image.alt='Drag across the source image to select a crop';image.draggable=false;
 apply.textContent='Apply crop';apply.type='button';area.append(image,outline);view.body.append(area,apply);
 let rect:MotifRect=initial??[0,0,1,1],start:{x:number;y:number;pointer:number;previous:MotifRect}|undefined;
 function render(){
  const [x,y,width,height]=rect;
  Object.assign(outline.style,{left:`${x*100}%`,top:`${y*100}%`,width:`${width*100}%`,height:`${height*100}%`});
  apply.disabled=!width||!height||!!start;
 }
 function point(event:PointerEvent){
  const {left,top,width,height}=area.getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(event.clientX-left)/width)),y:Math.max(0,Math.min(1,(event.clientY-top)/height))};
 }
 area.onpointerdown=event=>{
  if(event.button!==0||start)return;
  event.preventDefault();
  start={...point(event),pointer:event.pointerId,previous:rect};rect=[start.x,start.y,0,0];
  area.setPointerCapture(event.pointerId);render();
 };
 area.onpointermove=event=>{
  if(start?.pointer!==event.pointerId)return;
  const {x,y}=point(event);
  rect=[Math.min(start.x,x),Math.min(start.y,y),Math.abs(start.x-x),Math.abs(start.y-y)];render();
 };
 area.onpointerup=event=>{
  if(start?.pointer!==event.pointerId)return;
  area.onpointermove?.call(area,event);
  if(!rect[2]||!rect[3])rect=start.previous;
  start=undefined;render();
 };
 area.onlostpointercapture=event=>{
  if(start?.pointer!==event.pointerId)return;
  rect=start.previous;start=undefined;render();
 };
 apply.onclick=()=>{if(active())commit(rect);view.close();};
 render();
 return ()=>{if(view.root.isConnected)view.close();};
}
