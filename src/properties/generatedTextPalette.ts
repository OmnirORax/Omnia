import {textPaletteRGB,paletteInk,paletteSpread,type TextPalette} from './textPalette.ts';
export const GENERATED_PALETTE_SIZE=64;
type Pattern={key:string;glow:Uint8Array;ink:Uint8Array;css?:string};
const patterns=new Map<string,Pattern>();
/** Continuous seeded fields invent spatial arrangements; no timer or per-frame generation. */
export function generatedTextPalette(p:TextPalette){
 const key=JSON.stringify(p);let cached=patterns.get(key);if(cached)return cached;
 let seed=p.seed??1;seed=Math.imul(seed^(seed>>>16),0x45d9f3b)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const waves=Array.from({length:4},(_,i)=>({x:1+Math.floor(random()*5),y:Math.floor(random()*7)-3,phase:random()*Math.PI*2,gain:1/(i+1)})),sum=waves.reduce((n,w)=>n+w.gain,0),size=GENERATED_PALETTE_SIZE,glow=new Uint8Array(size*size*4),ink=new Uint8Array(glow.length),strength=paletteInk(p),spread=paletteSpread(p);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let u=x/(size-1),v=y/(size-1);if(p.layout==='vertical')[u,v]=[v,u];else if(p.layout==='diagonal')[u,v]=[(u+v)*.5,(u-v)*.5];else if(p.layout==='radial')[u,v]=[Math.hypot(u-.5,v-.5),Math.atan2(v-.5,u-.5)/Math.PI/2];const field=waves.reduce((n,w)=>n+Math.sin((w.x*u+w.y*v)*Math.PI*2*spread+w.phase)*w.gain,0)/sum,rgb=textPaletteRGB(p,.5+field*.5),at=(y*size+x)*4;for(let c=0;c<3;c++){glow[at+c]=Math.round(rgb[c]*255);ink[at+c]=Math.round(255*(1-strength+strength*rgb[c]));}glow[at+3]=ink[at+3]=255;}
 cached={key,glow,ink};patterns.set(key,cached);if(patterns.size>16)patterns.delete(patterns.keys().next().value!);return cached;
}
export function generatedTextPaletteCSS(p:TextPalette){const pattern=generatedTextPalette(p);if(!pattern.css){const canvas=document.createElement('canvas');canvas.width=canvas.height=GENERATED_PALETTE_SIZE;const ctx=canvas.getContext('2d')!;const pixels=ctx.createImageData(canvas.width,canvas.height);pixels.data.set(pattern.ink);ctx.putImageData(pixels,0,0);pattern.css=`url("${canvas.toDataURL('image/png')}")`;}return pattern.css;}
