import {fieldQuotas,type ImageField} from '../properties/imageField.ts';
import type {ScenePalette} from './palette.ts';
const cache=new WeakMap<ScenePalette,Map<string,ImageField>>();
/** Project the bounded source itself, retaining position and detail at every sampled scale. */
export function imageField(source:ScenePalette,mapping:readonly number[],weights:readonly number[]):ImageField|undefined{
 const grid=source.spatial;if(!grid)return;let variants=cache.get(source);if(!variants){variants=new Map();cache.set(source,variants);}const key=JSON.stringify([mapping,weights]),found=variants.get(key);if(found)return found;
 const factor=Math.max(1,Math.ceil(Math.sqrt(weights.length/(grid.width*grid.height)))),w=grid.width*factor,h=grid.height*factor,size=w*h,original=Array.from({length:size},(_,at)=>mapping[grid.cells[Math.floor(Math.floor(at/w)/factor)*grid.width+Math.floor(at%w/factor)]]??-1),quota=fieldQuotas(weights,size),remaining=[...quota],scores=new Map<number,Float32Array>(),confidence=new Float32Array(size);
 // Summed-area tables make each neighborhood query constant-time. Only families
 // actually present in the source need a table, even with many manual inclusions.
 for(const color of new Set(original.filter(c=>c>=0))){const stride=w+1,integral=new Uint32Array(stride*(h+1)),values=new Float32Array(size);for(let y=0;y<h;y++){let sum=0;for(let x=0;x<w;x++){sum+=Number(original[y*w+x]===color);integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+sum;}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let evidence=original[y*w+x]===color?4:0;for(const [r,gain]of [[1,2],[4,1],[16,.5]]){const l=Math.max(0,x-r),t=Math.max(0,y-r),right=Math.min(w,x+r+1),bottom=Math.min(h,y+r+1);evidence+=gain*(integral[bottom*stride+right]-integral[t*stride+right]-integral[bottom*stride+l]+integral[t*stride+l])/((right-l)*(bottom-t));}values[y*w+x]=evidence;}scores.set(color,values);
 }
 for(let at=0;at<size;at++){let first=0,second=0;for(const values of scores.values()){const v=values[at];if(v>first){second=first;first=v;}else second=Math.max(second,v);}confidence[at]=first-second;}
 const order=Array.from({length:size},(_,i)=>i).sort((a,b)=>confidence[b]-confidence[a]||a-b),cells=Array<number>(size);
 for(const at of order){let best=-Infinity,color=0;for(let c=0;c<remaining.length;c++){if(!remaining[c])continue;const score=(scores.get(c)?.[at]??0)+remaining[c]/size*.001;if(score>best){best=score;color=c;}}cells[at]=color;remaining[color]--;}
 const result={width:w,height:h,cells};variants.set(key,result);if(variants.size>16)variants.delete(variants.keys().next().value!);return result;
}
