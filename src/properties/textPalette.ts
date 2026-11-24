import {paletteRGB,paletteHex} from '../scene/palette.ts';
export const PALETTE_LAYOUTS=[['horizontal','Horizontal'],['vertical','Vertical'],['diagonal','Diagonal'],['radial','Radial']] as const;
export const PALETTE_PATTERNS=[['smooth','Smooth'],['bands','Bands'],['shuffle','Shuffled gradient'],['random','Random bands']] as const;
export const PALETTE_SPREADS=[['wide','Wide'],['repeat','Repeat'],['dense','Dense']] as const;
export type PaletteSettings={layout?:typeof PALETTE_LAYOUTS[number][0];pattern?:typeof PALETTE_PATTERNS[number][0];spread?:typeof PALETTE_SPREADS[number][0];seed?:number};
export type TextPalette=PaletteSettings&{mode:'text';colors:readonly string[];weights?:readonly number[]};
export const PALETTE_STOP_LIMIT=24;
export function validPaletteSettings(p:PaletteSettings){return (p.layout===undefined||PALETTE_LAYOUTS.some(([id])=>id===p.layout))&&(p.pattern===undefined||PALETTE_PATTERNS.some(([id])=>id===p.pattern))&&(p.spread===undefined||PALETTE_SPREADS.some(([id])=>id===p.spread))&&(p.seed===undefined||Number.isInteger(p.seed)&&p.seed>=0&&p.seed<=0xffffffff);}
export function validTextPalette(value:unknown):value is TextPalette{const p=value as TextPalette;return !!p&&typeof p==='object'&&!Array.isArray(p)&&p.mode==='text'&&validPaletteSettings(p)&&Array.isArray(p.colors)&&p.colors.length>0&&p.colors.length<=8&&p.colors.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))&&(p.weights===undefined||Array.isArray(p.weights)&&p.weights.length===p.colors.length&&p.weights.every(w=>Number.isFinite(w)&&w>0&&w<=1));}
export const paletteSpread=(p:PaletteSettings)=>p.spread==='dense'?4:p.spread==='repeat'?2:1;
export const paletteLayout=(p:PaletteSettings)=>PALETTE_LAYOUTS.findIndex(([id])=>id===(p.layout??'horizontal'));
export type PaletteStop={rgb:number[];at:number};
const tables=new WeakMap<TextPalette,PaletteStop[]>();
/** Small, cached stop table is the canonical owner for CSS and world-label gradients. */
export function textPaletteStops(p:TextPalette){let cached=tables.get(p);if(cached)return cached;
 let seed=p.seed??1;seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=(seed^(seed>>>16))>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const colors=p.colors.map((color,i)=>({rgb:paletteRGB(color).map(c=>c/255),weight:p.weights?.[i]??1}));
 if(p.pattern==='shuffle'){if(colors.length===2){if((p.seed??1)%2)[colors[0],colors[1]]=[colors[1],colors[0]];}else for(let i=colors.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[colors[i],colors[j]]=[colors[j],colors[i]];}}
 const total=colors.reduce((sum,c)=>sum+c.weight,0),result:PaletteStop[]=[];let at=0;
 if(p.pattern==='random'){
  for(let i=0;i<12;i++){let pick=random()*total,chosen=colors.at(-1)!;for(const color of colors){pick-=color.weight;if(pick<0){chosen=color;break;}}result.push({rgb:chosen.rgb,at:i/12},{rgb:chosen.rgb,at:(i+1)/12});}
 }else if(p.pattern==='bands'){
  for(const c of colors){result.push({rgb:c.rgb,at});at+=c.weight/total;result.push({rgb:c.rgb,at});}
 }else{
  result.push({rgb:colors[0].rgb,at:0});for(let i=0;i<colors.length-1;i++){const a=colors[i],b=colors[i+1],half=Math.min(a.weight,b.weight)/total*.35;at+=a.weight/total;result.push({rgb:a.rgb,at:at-half});if(!a.rgb.some((c,k)=>c>=.999&&b.rgb[k]>=.999))result.push({rgb:[1,1,1],at});result.push({rgb:b.rgb,at:at+half});}result.push({rgb:colors.at(-1)!.rgb,at:1});
 }
 tables.set(p,result);return result;
}
export function textPalettePair(p:TextPalette,position:number){const stops=textPaletteStops(p),x=Math.max(0,Math.min(1,position));let a=stops[0],rgb=a.rgb;for(let i=1;i<stops.length;i++){const b=stops[i];if(x<b.at){const t=(x-a.at)/Math.max(.000001,b.at-a.at);rgb=a.rgb.map((c,k)=>c+(b.rgb[k]-c)*t);break;}a=b;rgb=b.rgb;}return {color:paletteHex(rgb.map(c=>255*(.75+c*.25))),glowColor:paletteHex(rgb.map(c=>c*255))};}
export function textPaletteCSS(p:TextPalette){const period=100/paletteSpread(p),stops=textPaletteStops(p).map(s=>`${paletteHex(s.rgb.map(c=>255*(.75+c*.25)))} ${s.at*period}%`).join(','),repeat=paletteSpread(p)>1?'repeating-':'';return p.layout==='radial'?`${repeat}radial-gradient(ellipse farthest-corner at center in srgb,${stops})`:`${repeat}linear-gradient(${p.layout==='vertical'?'180deg':p.layout==='diagonal'?'135deg':'90deg'} in srgb,${stops})`;}
