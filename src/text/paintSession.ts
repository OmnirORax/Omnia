import type {Paint} from '../properties/visual.ts';
/** Cache the paint actually displayed, whether authored or previewed. */
export function createDocumentPaintSession(apply:(paint:Paint)=>void,applyOpacity?:(opacity:number)=>void){
 let displayed:string|undefined,displayedOpacity:number|undefined;
 return {render(paint:Paint,opacity=1){
  const key=JSON.stringify(paint),paintChanged=key!==displayed,opacityChanged=!!applyOpacity&&opacity!==displayedOpacity;
  if(paintChanged){apply(paint);displayed=key;}
  if(opacityChanged){applyOpacity!(opacity);displayedOpacity=opacity;}
  return paintChanged||opacityChanged;
 }};
}
