import {paletteRGB} from '../scene/palette.ts';
import {paletteInk,type TextPalette} from './textPalette.ts';
export {FOCUS_DISTRIBUTIONS} from './textPalette.ts';
export const RATIO_BUDGET=4096;
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
export function minimumRatio(counts:readonly number[]){const divisor=counts.reduce(gcd);return counts.map(n=>n/divisor);}
/** Smallest integer ratio distinguishable at the existing 4096-pixel sampling resolution. */
const ratios=new Map<string,number[]>();
export function imageRatio(weights:readonly number[]){const key=weights.join(',');let found=ratios.get(key);if(found)return found;found=deriveImageRatio(weights);ratios.set(key,found);if(ratios.size>64)ratios.delete(ratios.keys().next().value!);return found;}
function deriveImageRatio(weights:readonly number[]){
 const sum=weights.reduce((a,b)=>a+b,0),shares=weights.map(n=>n/sum);
 for(let total=shares.length;total<=RATIO_BUDGET;total++){
  const counts=shares.map(w=>Math.max(1,Math.round(w*total)));
  if(counts.reduce((a,b)=>a+b,0)<=RATIO_BUDGET&&counts.every((n,i)=>Math.abs(n/total-shares[i])<=.5/RATIO_BUDGET)&&counts.reduce((a,b)=>a+b,0)===total)return minimumRatio(counts);
 }
 const counts=shares.map(w=>Math.max(1,Math.floor(w*(RATIO_BUDGET-shares.length))));return minimumRatio(counts);
}
export const isFocusPalette=(p:TextPalette)=>p.distribution!==undefined;
export function focusRatio(p:TextPalette){return minimumRatio(p.imageRatio?.length===p.colors.length?p.imageRatio:imageRatio(p.weights??p.colors.map(()=>1)));}
export type FocusPattern={key:string;indices:number[];glow:Uint8Array;ink:Uint8Array;css?:string};
const patterns=new Map<string,FocusPattern>();
/** Every arrangement owns only order; the image-derived integer counts stay fixed. */
export function focusSequence(ratio:readonly number[],distribution:TextPalette['distribution']='balanced'){
 const total=ratio.reduce((a,b)=>a+b,0),indices:number[]=[];
 if(distribution==='grouped'||distribution==='centered'){
  for(let i=0;i<ratio.length;i++)for(let j=0;j<ratio[i];j++)indices.push(i);
  if(distribution==='centered'){const largest=ratio.indexOf(Math.max(...ratio)),at=ratio.slice(0,largest).reduce((a,b)=>a+b,0)+Math.ceil(ratio[largest]/2);indices.push(...indices.splice(0,at));}
 }else if(distribution==='alternating'||distribution==='alternating-end'||distribution==='paired'||distribution==='growing'){
  const remaining=[...ratio];let run=distribution==='paired'?2:1;
  while(remaining.filter(n=>n>0).length>1){
   for(let i=0;i<remaining.length;i++){const take=Math.min(run,remaining[i]);for(let j=0;j<take;j++)indices.push(i);remaining[i]-=take;}
   if(distribution==='growing')run++;
  }
  const color=remaining.findIndex(n=>n>0),tail=color<0?[]:Array<number>(remaining[color]).fill(color);
  if(distribution==='alternating-end')indices.unshift(...tail);else indices.push(...tail);
 }else{
  const used=ratio.map(()=>0);
  for(let at=0;at<total;at++){let best=-Infinity,color=0;for(let i=0;i<ratio.length;i++){if(used[i]>=ratio[i])continue;const deficit=(at+1)*ratio[i]-used[i]*total;if(deficit>best){best=deficit;color=i;}}indices.push(color);used[color]++;}
  if(distribution==='mirrored')indices.push(...[...indices].reverse());
 }
 return indices;
}
/** One bounded pixel cycle is shared by DOM text, window contours and world labels. */
export function focusPattern(p:TextPalette){
 const ratio=focusRatio(p),key=JSON.stringify([p.colors,ratio,p.distribution,paletteInk(p)]);let found=patterns.get(key);if(found)return found;
 const indices=focusSequence(ratio,p.distribution);
 const glow=new Uint8Array(indices.length*4),ink=new Uint8Array(glow.length),strength=paletteInk(p),colors=p.colors.map(paletteRGB);
 for(let i=0;i<indices.length;i++){for(let c=0;c<3;c++){glow[i*4+c]=colors[indices[i]][c];ink[i*4+c]=Math.round(255*(1-strength)+glow[i*4+c]*strength);}glow[i*4+3]=ink[i*4+3]=255;}
 found={key,indices,glow,ink};patterns.set(key,found);if(patterns.size>16)patterns.delete(patterns.keys().next().value!);return found;
}
export function focusPaletteCSS(p:TextPalette){const pattern=focusPattern(p);if(!pattern.css){const canvas=document.createElement('canvas');canvas.width=pattern.indices.length;canvas.height=1;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(canvas.width,1);pixels.data.set(pattern.ink);ctx.putImageData(pixels,0,0);pattern.css=`url("${canvas.toDataURL('image/png')}")`;}return pattern.css;}
export const focusPeriod=(p:TextPalette)=>focusPattern(p).indices.length*(p.scale??1);
