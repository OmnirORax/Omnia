import type {Paint} from '../properties/visual.ts';
import type {SurfaceTransmission} from '../properties/translucency.ts';

/** Cache the paint actually displayed, whether authored or previewed. */
export function createDocumentPaintSession(apply:(paint:Paint)=>void,applyTransmission?:(value:SurfaceTransmission)=>void){
 let displayed:string|undefined,previousTransmission:string|undefined;
 return {render(paint:Paint,transmission?:SurfaceTransmission){
  const key=JSON.stringify(paint),paintChanged=key!==displayed;
  const transmissionKey=JSON.stringify(transmission),transmissionChanged=!!applyTransmission&&!!transmission&&transmissionKey!==previousTransmission;
  if(paintChanged){apply(paint);displayed=key;}
  if(transmissionChanged){applyTransmission(transmission);previousTransmission=transmissionKey;}
  return paintChanged||transmissionChanged;
 }};
}
