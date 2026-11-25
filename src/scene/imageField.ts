import {sourceFieldPixels,fieldQuotas,type ImageField} from '../properties/imageField.ts';
import {paletteRGB,type ScenePalette} from './palette.ts';
const cache=new WeakMap<ScenePalette,Map<string,ImageField>>();
/** Project the bounded source itself, simplifying details into selected motif regions. */
export function imageField(source:ScenePalette,mapping:readonly number[],weights:readonly number[],colors:readonly string[]=[]):ImageField|undefined{
 const grid=source.spatial;if(!grid)return;let variants=cache.get(source);if(!variants){variants=new Map();cache.set(source,variants);}const key=JSON.stringify([mapping,weights,colors]),found=variants.get(key);if(found)return found;
 const factor=Math.max(1,Math.ceil(Math.sqrt(weights.length/(grid.width*grid.height)))),w=grid.width*factor,h=grid.height*factor,size=w*h,original=Array.from({length:size},(_,at)=>mapping[grid.cells[Math.floor(Math.floor(at/w)/factor)*grid.width+Math.floor(at%w/factor)]]??-1),quota=fieldQuotas(weights,size),remaining=[...quota],scores=new Map<number,Float32Array>(),confidence=new Float32Array(size);
 // Fill disabled regions from the closest surviving region before smoothing.
 const owners=Int16Array.from(original),queue=new Int32Array(size);let end=0;
 for(let at=0;at<size;at++)if(owners[at]>=0)queue[end++]=at;
 for(let head=0;head<end;head++){const at=queue[head],x=at%w,y=Math.floor(at/w);for(const next of [x>0?at-1:-1,x<w-1?at+1:-1,y>0?at-w:-1,y<h-1?at+w:-1])if(next>=0&&owners[next]<0){owners[next]=owners[at];queue[end++]=next;}}
 if(!end)owners.fill(0);
 // A small neighborhood drops isolated details. Source-tone similarity helps
 // disabled regions merge into a nearby surviving family rather than random ink.
 const rgb=grid.rgb,pixels=rgb?sourceFieldPixels({width:grid.width,height:grid.height,cells:[],rgb}):undefined,tones=colors.map(paletteRGB),means=new Float32Array(size*3);
 if(rgb)for(let y=0;y<h;y++)for(let x=0;x<w;x++){let count=0;for(let ny=Math.max(0,y-1);ny<=Math.min(h-1,y+1);ny++)for(let nx=Math.max(0,x-1);nx<=Math.min(w-1,x+1);nx++){const at=(Math.floor(ny/factor)*grid.width+Math.floor(nx/factor))*4;for(let k=0;k<3;k++)means[(y*w+x)*3+k]+=pixels![at+k];count++;}for(let k=0;k<3;k++)means[(y*w+x)*3+k]/=count;}
 for(const color of new Set(owners)){const values=new Float32Array(size);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let count=0,same=0;for(let ny=Math.max(0,y-1);ny<=Math.min(h-1,y+1);ny++)for(let nx=Math.max(0,x-1);nx<=Math.min(w-1,x+1);nx++){same+=Number(owners[ny*w+nx]===color);count++;}const at=y*w+x,tone=tones[color],similarity=rgb&&tone?1-tone.reduce((sum,v,k)=>sum+(v-means[at*3+k])**2,0)/(3*255**2):0;values[at]=same/count+(similarity*.25);}scores.set(color,values);}

 for(let at=0;at<size;at++){let first=0,second=0;for(const values of scores.values()){const v=values[at];if(v>first){second=first;first=v;}else second=Math.max(second,v);}confidence[at]=first-second;}
 const order=Array.from({length:size},(_,i)=>i).sort((a,b)=>confidence[b]-confidence[a]||a-b),cells=Array<number>(size);
 for(const at of order){let best=-Infinity,color=0;for(let c=0;c<remaining.length;c++){if(!remaining[c])continue;const score=(scores.get(c)?.[at]??0)+remaining[c]/size*.001;if(score>best){best=score;color=c;}}cells[at]=color;remaining[color]--;}
 const result={width:w,height:h,cells,fit:true};variants.set(key,result);if(variants.size>16)variants.delete(variants.keys().next().value!);return result;
}
