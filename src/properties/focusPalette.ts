import {relationPattern} from './relationPattern.ts';
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
export type FocusPattern={key:string;indices:number[];glow:Uint8Array;ink:Uint8Array;css?:string;verticalCSS?:string};
const patterns=new Map<string,FocusPattern>();
/** Every arrangement owns only order; the image-derived integer counts stay fixed. */
export function focusSequence(ratio:readonly number[],distribution:Exclude<TextPalette['distribution'],'image'>='balanced',inverse=false,repetition?:number){
 const base=ratio.reduce((a,b)=>a+b,0),repeat=repetition??(distribution==='growing'||inverse?Math.min(4,Math.max(1,Math.floor(RATIO_BUDGET/base))):1),counts=ratio.map(n=>n*repeat),total=base*repeat,indices:number[]=[],remaining=[...counts];
 if(inverse&&distribution==='balanced'){
  // Cluster the same counts; choose the cyclic color order with least overlap.
  const cycle=focusSequence(ratio,distribution),original=Array.from({length:total},(_,i)=>cycle[i%cycle.length]);let best:number[]=[];let overlap=Infinity;
  for(let shift=0;shift<ratio.length;shift++){const candidate:number[]=[];for(let j=0;j<ratio.length;j++){const i=(j+shift)%ratio.length;for(let n=0;n<counts[i];n++)candidate.push(i);}const score=candidate.reduce((n,color,i)=>n+Number(color===original[i]),0);if(score<overlap){overlap=score;best=candidate;}}
  return best;
 }
 if(distribution==='growing'&&!inverse){
  let run=1;
  while(remaining.some(n=>n>0)){for(let i=0;i<remaining.length;i++){const take=Math.min(run,remaining[i]);for(let j=0;j<take;j++)indices.push(i);remaining[i]-=take;}run++;}
 }else{
  const used=ratio.map(()=>0);
  for(let at=0;at<total;at++){let best=-Infinity,color=0;for(let i=0;i<ratio.length;i++){if(used[i]>=counts[i])continue;const deficit=(at+1)*counts[i]-used[i]*total;if(deficit>best){best=deficit;color=i;}}indices.push(color);used[color]++;}
 }
 return indices;
}
/** One bounded pixel cycle is shared by DOM text, window contours and world labels. */
export function focusPattern(p:TextPalette){
 const ratio=focusRatio(p),relations=p.distribution==='image'?p.relations?.[p.distributionAxis==='vertical'?'vertical':'horizontal']:undefined,key=JSON.stringify([p.colors,ratio,p.distribution,p.inverseDistribution,paletteInk(p),relations]);let found=patterns.get(key);if(found)return found;
 const indices=relations&&p.colors.length>1?relationPattern(ratio,relations,!!p.inverseDistribution,(counts,growing)=>focusSequence(counts,growing?'growing':'balanced',false,1),RATIO_BUDGET):focusSequence(ratio,p.distribution==='image'?'balanced':p.distribution,p.inverseDistribution);
 const glow=new Uint8Array(indices.length*4),ink=new Uint8Array(glow.length),strength=paletteInk(p),colors=p.colors.map(paletteRGB);
 for(let i=0;i<indices.length;i++){for(let c=0;c<3;c++){glow[i*4+c]=colors[indices[i]][c];ink[i*4+c]=Math.round(255*(1-strength)+glow[i*4+c]*strength);}glow[i*4+3]=ink[i*4+3]=255;}
 found={key,indices,glow,ink};patterns.set(key,found);if(patterns.size>16)patterns.delete(patterns.keys().next().value!);return found;
}
export const focusPaletteAxis=(p:TextPalette)=>p.distributionAxis==='vertical'?1:0;
export function focusPaletteCSS(p:TextPalette){const pattern=focusPattern(p),vertical=focusPaletteAxis(p)===1,key=vertical?'verticalCSS':'css';if(!pattern[key]){const canvas=document.createElement('canvas');canvas.width=vertical?1:pattern.indices.length;canvas.height=vertical?pattern.indices.length:1;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(canvas.width,canvas.height);pixels.data.set(pattern.ink);ctx.putImageData(pixels,0,0);pattern[key]=`url("${canvas.toDataURL('image/png')}")`;}return pattern[key]!;}
export function focusPaletteGeometry(p:TextPalette){const period=focusPeriod(p);return focusPaletteAxis(p)===1?{size:`100% ${period}px`,repeat:'repeat-y'}:{size:`${period}px 100%`,repeat:'repeat-x'};}
export const focusPeriod=(p:TextPalette)=>focusPattern(p).indices.length*(p.scale??1);
