import {sourceFieldPixels,type ImageField} from '../properties/imageField.ts';
import {paletteRGB,type ScenePalette} from './palette.ts';
const cache=new WeakMap<ScenePalette,Map<string,ImageField>>();
/** Project the bounded source itself, simplifying details into selected motif regions. */
export function imageField(source:ScenePalette,mapping:readonly number[],weights:readonly number[],colors:readonly string[]=[],inverseOccupation=false):ImageField|undefined{
 const grid=source.spatial;if(!grid)return;let variants=cache.get(source);if(!variants){variants=new Map();cache.set(source,variants);}const key=JSON.stringify([mapping,weights,colors,inverseOccupation]),found=variants.get(key);if(found)return found;
 const w=grid.width,h=grid.height,size=w*h,original=Array.from(grid.cells,i=>mapping[i]??-1);
 // Fill disabled regions from the closest surviving region before smoothing.
 const owners=Int16Array.from(original),queue=new Int32Array(size);let end=0;
 for(let at=0;at<size;at++)if(owners[at]>=0)queue[end++]=at;
 for(let head=0;head<end;head++){const at=queue[head],x=at%w,y=Math.floor(at/w);for(const next of [x>0?at-1:-1,x<w-1?at+1:-1,y>0?at-w:-1,y<h-1?at+w:-1])if(next>=0&&owners[next]<0){owners[next]=owners[at];queue[end++]=next;}}
 if(!end)owners.fill(0);
 // Preserve connected strokes, including thin highlights. Only isolated
 // dots/pairs yield to the nearby majority, with source-tone similarity as a tie-break.
 const pixels=grid.rgb?sourceFieldPixels({width:w,height:h,cells:[],rgb:grid.rgb}):undefined,tones=colors.map(paletteRGB),votes=new Uint8Array(weights.length),cells=Array<number>(size);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=y*w+x,own=owners[at];votes.fill(0);let count=0;
  for(let ny=Math.max(0,y-1);ny<=Math.min(h-1,y+1);ny++)for(let nx=Math.max(0,x-1);nx<=Math.min(w-1,x+1);nx++){votes[owners[ny*w+nx]]++;count++;}
  let color=own;if(votes[own]<3&&w>2&&h>2){const mean=[0,0,0];if(pixels)for(let ny=Math.max(0,y-1);ny<=Math.min(h-1,y+1);ny++)for(let nx=Math.max(0,x-1);nx<=Math.min(w-1,x+1);nx++)for(let k=0;k<3;k++)mean[k]+=pixels[(ny*w+nx)*4+k]/count;
   let best=-Infinity;for(let c=0;c<votes.length;c++){if(!votes[c])continue;const tone=tones[c],similarity=pixels&&tone?1-tone.reduce((sum,v,k)=>sum+(v-mean[k])**2,0)/(3*255**2):0,score=votes[c]/count+similarity*.25;if(score>best){best=score;color=c;}}
  }cells[at]=color;
 }
 // Reverse the assignment of existing region shares, rather than moving pixels.
 if(inverseOccupation){const counts=weights.map(()=>0);for(const c of cells)counts[c]++;const order=counts.map((_,i)=>i).sort((a,b)=>counts[b]-counts[a]||a-b),swap=weights.map((_,i)=>i);for(let i=0;i<order.length;i++)swap[order[i]]=order[order.length-1-i];for(let i=0;i<cells.length;i++)cells[i]=swap[cells[i]];}

 const native=grid.native?{...grid.native,mapping:[...mapping]}:undefined;if(native&&inverseOccupation){const counts=weights.map(()=>0);for(const c of owners)counts[c]++;const order=counts.map((_,i)=>i).sort((a,b)=>counts[b]-counts[a]||a-b),swap=weights.map((_,i)=>i);for(let i=0;i<order.length;i++)swap[order[i]]=order[order.length-1-i];native.mapping=native.mapping.map(c=>c<0?c:swap[c]);}
 const result={width:w,height:h,cells,fit:true,native};variants.set(key,result);if(variants.size>16)variants.delete(variants.keys().next().value!);return result;
}
