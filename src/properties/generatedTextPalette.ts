import {paletteRGB} from '../scene/palette.ts';
import {paletteInk,paletteSpread,type TextPalette} from './textPalette.ts';
export const GENERATED_PALETTE_SIZE=64;
type Pattern={key:string;glow:Uint8Array;ink:Uint8Array;css?:string};
const patterns=new Map<string,Pattern>();
/** Continuous seeded fields invent spatial arrangements; no timer or per-frame generation. */
export function generatedTextPalette(p:TextPalette){
 const key=JSON.stringify(p);let cached=patterns.get(key);if(cached)return cached;
 let seed=p.seed??1;seed=Math.imul(seed^(seed>>>16),0x45d9f3b)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const size=GENERATED_PALETTE_SIZE,count=size*size,glow=new Uint8Array(count*4),ink=new Uint8Array(glow.length),strength=paletteInk(p),spread=paletteSpread(p),angle=(random()-.5)*.8,frequency=.4+random()*2.2,phase=random()*Math.PI*2,center={x:random(),y:random()*2-.5},weights=Array.from({length:4},()=>random()**4+.001),sum=weights.reduce((a,b)=>a+b,0),sites=Array.from({length:3+Math.floor(random()*3)},()=>({x:random(),y:random(),value:random()})),field=new Float32Array(count);
 let low=Infinity,high=-Infinity;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let u=x/(size-1),v=y/(size-1);if(p.layout==='vertical')[u,v]=[v,u];else if(p.layout==='diagonal')[u,v]=[(u+v)*.5,(u-v)*.5];v=.5+(v-.5)*.05;
  const axis=u*Math.cos(angle)+v*Math.sin(angle),wave=Math.sin(axis*frequency*Math.PI*2*spread+Math.sin(u*3+phase)*.8+phase),ring=Math.cos(Math.hypot(u-center.x,v-center.y)*frequency*Math.PI*2*spread+phase);let value=0,total=0;for(const site of sites){const influence=1/(.02+(u-site.x)**2+(v-site.y)**2);value+=site.value*influence;total+=influence;}
  const n=(weights[0]*axis+weights[1]*wave+weights[2]*ring+weights[3]*value/total)/sum;field[y*size+x]=n;low=Math.min(low,n);high=Math.max(high,n);
 }
 // Equalize the field before mapping palette weights: midpoints cannot swallow the image.
 const histogram=new Uint32Array(256),quantiles=new Float32Array(256),bin=(n:number)=>Math.max(0,Math.min(255,Math.floor((n-low)/Math.max(.000001,high-low)*255)));for(const n of field)histogram[bin(n)]++;
 let covered=0;for(let i=0;i<256;i++){quantiles[i]=(covered+histogram[i]*.5)/count;covered+=histogram[i];}
 const colors=p.colors.map(c=>paletteRGB(c).map(v=>v/255)),mass=p.colors.map((_,i)=>p.weights?.[i]??1),massTotal=mass.reduce((a,b)=>a+b,0),edges:number[]=[];let cumulative=0;for(const w of mass){cumulative+=w/massTotal;edges.push(cumulative);}const softness=p.softness??(.04+random()*.18);
 for(let i=0;i<count;i++){const at=i*4,t=quantiles[bin(field[i])];let chosen=edges.findIndex(edge=>t<edge);if(chosen<0)chosen=colors.length-1;let rgb=colors[chosen];for(let j=0;j<colors.length-1;j++){const half=Math.min(mass[j],mass[j+1])/massTotal*softness;if(Math.abs(t-edges[j])<half){const blend=(t-edges[j]+half)/(2*half);rgb=colors[j].map((v,k)=>v+(colors[j+1][k]-v)*blend);break;}}
  for(let c=0;c<3;c++){glow[at+c]=Math.round(rgb[c]*255);ink[at+c]=Math.round(255*(1-strength+strength*rgb[c]));}glow[at+3]=ink[at+3]=255;
 }
 cached={key,glow,ink};patterns.set(key,cached);if(patterns.size>16)patterns.delete(patterns.keys().next().value!);return cached;
}
export function generatedTextPaletteCSS(p:TextPalette){const pattern=generatedTextPalette(p);if(!pattern.css){const canvas=document.createElement('canvas');canvas.width=canvas.height=GENERATED_PALETTE_SIZE;const ctx=canvas.getContext('2d')!;const pixels=ctx.createImageData(canvas.width,canvas.height);pixels.data.set(pattern.ink);ctx.putImageData(pixels,0,0);pattern.css=`url("${canvas.toDataURL('image/png')}")`;}return pattern.css;}
