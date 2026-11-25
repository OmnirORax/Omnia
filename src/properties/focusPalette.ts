import {nativeFieldSource,retainNativeField} from './nativeField.ts';
import {sourceFieldPixels,inverseField} from './imageField.ts';
import {relationPattern} from './relationPattern.ts';
import {paletteRGB} from '../scene/palette.ts';
import {paletteInk,textPaletteStops,PALETTE_STOP_LIMIT,type TextPalette} from './textPalette.ts';
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
export const isFocusPalette=(p:TextPalette)=>p.distribution!==undefined||textPaletteStops(p).length>PALETTE_STOP_LIMIT;
export function focusRatio(p:TextPalette){return minimumRatio(p.imageRatio?.length===p.colors.length?p.imageRatio:imageRatio(p.weights??p.colors.map(()=>1)));}
export type FocusPattern={key:string;width:number;height:number;indices:readonly number[]|Uint8Array;glow:Uint8Array;ink:Uint8Array;css?:string;verticalCSS?:string};
const patterns=new Map<string,FocusPattern>(),patternPins=new Map<string,number>();
const patternBytes=(p:FocusPattern)=>p.glow.byteLength+(p.ink.buffer===p.glow.buffer?0:p.ink.byteLength)+(p.indices instanceof Uint8Array?p.indices.byteLength:0);
function trimPatterns(protectedKey?:string){let bytes=[...patterns.values()].reduce((n,p)=>n+patternBytes(p),0);for(const [key,p]of patterns){if(bytes<=128*1024*1024&&patterns.size<=16)break;if(key===protectedKey||patternPins.get(key))continue;patterns.delete(key);bytes-=patternBytes(p);}}
export function retainFocusPattern(p:TextPalette){const pattern=focusPattern(p),key=pattern.key;patternPins.set(key,(patternPins.get(key)??0)+1);const release=p.field?.native?retainNativeField(p.field.native.key):()=>{};return()=>{const n=(patternPins.get(key)??1)-1;if(n)patternPins.set(key,n);else patternPins.delete(key);release();trimPatterns();};}
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
export const isImageField=(p:TextPalette|undefined)=>p?.distribution==='image'&&!!p.field;
export const isSourceField=(p:TextPalette|undefined)=>isImageField(p)&&typeof p?.field?.rgb==='string';
export const isFittedField=(p:TextPalette|undefined)=>isImageField(p)&&(isSourceField(p)||p?.field?.fit===true);
export const hasPalettePaint=(p:TextPalette|undefined)=>!!p&&(p.colors.length>1||isSourceField(p));
export function focusPattern(p:TextPalette){
 const resource=p.field?.native?nativeFieldSource(p.field.native.key):undefined,source=isSourceField(p),ratio=focusRatio(p),relations=p.distribution==='image'&&!isImageField(p)?p.relations?.[p.distributionAxis==='vertical'?'vertical':'horizontal']:undefined,key=source?JSON.stringify([p.field,paletteInk(p)]):JSON.stringify([p.colors,ratio,p.distribution,p.inverseDistribution,paletteInk(p),relations,isImageField(p)?p.field:undefined,resource?.revision]);let found=patterns.get(key);if(found){patterns.delete(key);patterns.set(key,found);return found;}
 const field=isImageField(p)?(!source&&p.inverseDistribution?inverseField(p.field!):p.field):undefined;
 let indices:readonly number[]|Uint8Array=field?field.cells:relations&&p.colors.length>1?relationPattern(ratio,relations,!!p.inverseDistribution,(counts,growing)=>focusSequence(counts,growing?'growing':'balanced',false,1),RATIO_BUDGET):focusSequence(ratio,p.distribution==='image'?'balanced':p.distribution,p.inverseDistribution);
 let width=field?.width??indices.length,height=field?.height??1;
 if(resource&&field?.native){width=resource.width;height=resource.height;const ref=field.native,dx=Math.floor((ref.offset?.[0]??0)*width),dy=Math.floor((ref.offset?.[1]??0)*height),mapped=new Uint8Array(width*height),lookup=ref.mapping;for(let y=0;y<height;y++){const row=y*width,sourceRow=((y+dy)%height)*width,fallbackRow=Math.floor(y*field.height/height)*field.width;for(let x=0;x<width;x++){const family=resource.indices[sourceRow+(dx?(x+dx)%width:x)],color=lookup[family]??-1;mapped[row+x]=color>=0?color:field.cells[fallbackRow+Math.floor(x*field.width/width)];}}indices=mapped;}
 const strength=paletteInk(p),glow=source?sourceFieldPixels(field!):new Uint8Array(indices.length*4),ink=strength===1?glow:new Uint8Array(glow.length),colors=p.colors.map(paletteRGB);
 if(source){if(ink!==glow)for(let i=0;i<glow.length;i+=4){for(let c=0;c<3;c++)ink[i+c]=Math.round(255*(1-strength)+glow[i+c]*strength);ink[i+3]=255;}}
 else{const table=new Uint8Array(colors.length*4),inkTable=new Uint8Array(table.length);for(let i=0;i<colors.length;i++){for(let c=0;c<3;c++){table[i*4+c]=colors[i][c];inkTable[i*4+c]=Math.round(255*(1-strength)+colors[i][c]*strength);}table[i*4+3]=inkTable[i*4+3]=255;}const packed=new Uint32Array(table.buffer),packedInk=new Uint32Array(inkTable.buffer),out=new Uint32Array(glow.buffer),outInk=new Uint32Array(ink.buffer);for(let i=0;i<indices.length;i++){out[i]=packed[indices[i]];if(ink!==glow)outInk[i]=packedInk[indices[i]];}}

 found={key,indices,width,height,glow,ink};patterns.set(key,found);trimPatterns(key);return found;
}
export const focusPaletteAxis=(p:TextPalette)=>p.distributionAxis==='vertical'?1:0;
export function focusPaletteCSS(p:TextPalette,straightStream=false){const pattern=focusPattern(p),vertical=!isImageField(p)&&!straightStream&&focusPaletteAxis(p)===1,key=vertical?'verticalCSS':'css';if(!pattern[key]){const canvas=document.createElement('canvas');canvas.width=isImageField(p)?pattern.width:vertical?1:pattern.indices.length;canvas.height=isImageField(p)?pattern.height:vertical?pattern.indices.length:1;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(canvas.width,canvas.height);pixels.data.set(pattern.ink);ctx.putImageData(pixels,0,0);pattern[key]=`url("${canvas.toDataURL('image/png')}")`;}return pattern[key]!;}
export function focusPaletteGeometry(p:TextPalette){if(isFittedField(p))return {size:'cover',repeat:'no-repeat'};if(isImageField(p)){const f=focusPattern(p),scale=p.scale??1;return {size:`${f.width*scale}px ${f.height*scale}px`,repeat:'repeat'};}const period=focusPeriod(p);return focusPaletteAxis(p)===1?{size:`100% ${period}px`,repeat:'repeat-y'}:{size:`${period}px 100%`,repeat:'repeat-x'};}
export const focusPeriod=(p:TextPalette)=>Math.max(1,focusPattern(p).indices.length)*(p.scale??1);
