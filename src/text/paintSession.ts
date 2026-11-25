import type {Paint} from '../properties/visual.ts';
/** Cache the paint actually displayed, whether authored or previewed. */
export function createDocumentPaintSession(apply:(paint:Paint)=>void){
 let displayed:string|undefined;
 return {render(paint:Paint){const key=JSON.stringify(paint);if(key===displayed)return false;apply(paint);displayed=key;return true;}};
}
