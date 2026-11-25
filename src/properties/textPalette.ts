import {validMotifCrop,validPixelMotifs,type MotifCrop,type PixelMotifs} from './pixelMotifs.ts';
import {validImageField,type ImageField} from './imageField.ts';
import {PALETTE_COLOR_LIMIT,validColorRelations,type ColorRelations} from './colorRelations.ts';
import {paletteRGB,paletteHex,colorHue} from '../scene/palette.ts';
export const PALETTE_LAYOUTS=[['horizontal','Horizontal'],['vertical','Vertical'],['diagonal','Diagonal'],['radial','Radial']] as const;
export const PALETTE_PATTERNS=[['smooth','Smooth'],['bands','Bands']] as const;
export const PALETTE_MATCHES=[['motif','Motif'],['light','Accent + white'],['dark','Accent + black'],['palette','Image palette'],['accents','Color only']] as const;

export const PALETTE_INKS=[['pale','Pale text'],['color','Colored text']] as const;
export const PALETTE_SPREADS=[['wide','Wide'],['repeat','Repeat'],['dense','Dense']] as const;
export const PALETTE_DISTRIBUTION_AXES=[['horizontal','Horizontal'],['vertical','Vertical']] as const;
export const PALETTE_PROGRESSIONS=[['horizontal','Straight'],['ink-serpentine','Ink serpentine'],['start-end','Start–end']] as const;
export const FOCUS_DISTRIBUTIONS=[['image','Image relations'],['pixels','Image pixels'],['balanced','Balanced'],['growing','Growing rows']] as const;
export {PALETTE_COLOR_LIMIT} from './colorRelations.ts';
export type PaletteSettings={repeatMotifs?:boolean;centerImagePixels?:boolean;motifCrop?:MotifCrop;paleAmount?:number;fillOpacity?:number;debugPattern?:boolean;included?:readonly string[];motifOverrides?:Readonly<Record<string,boolean>>;inverseOccupation?:boolean;inverseDistribution?:boolean;distributionAxis?:typeof PALETTE_DISTRIBUTION_AXES[number][0];progression?:typeof PALETTE_PROGRESSIONS[number][0];distribution?:typeof FOCUS_DISTRIBUTIONS[number][0];scale?:number;softness?:number;balance?:number;saturation?:number;layout?:typeof PALETTE_LAYOUTS[number][0];pattern?:typeof PALETTE_PATTERNS[number][0]|'generated';match?:typeof PALETTE_MATCHES[number][0];ink?:typeof PALETTE_INKS[number][0];spread?:typeof PALETTE_SPREADS[number][0];seed?:number};
export type TextPalette=PaletteSettings&{pixelMotifs?:PixelMotifs;field?:ImageField;relations?:ColorRelations;mode:'text';colors:readonly string[];pixelSources?:readonly string[];weights?:readonly number[];strength?:number;darkSupport?:boolean;available?:number;imageRatio?:readonly number[]};
export const PALETTE_STOP_LIMIT=24;
export const PALETTE_SATURATION_MAX=2;
export const PALETTE_SCALE={min:.01,max:4096,step:.01} as const;
/** Discard only settings written by the removed motif-field experiment. */
export function retirePaletteRework(value:unknown){
 const p=value as PaletteSettings&Record<string,unknown>;
 if(!p||typeof p!=='object'||Array.isArray(p)||p.motif!==true)return false;
 // The experiment allowed quarter-scale values; the restored control starts at one.
 if(typeof p.scale==='number'&&Number.isFinite(p.scale)&&p.scale>=.25&&p.scale<1)p.scale=1;
 for(const key of ['motif','motifSelection','inverseDistribution','inverseOccupation','motifField','motifSwatches'])delete p[key];
 return true;
}

/** Retire the experimental manual override; ratios belong to the resolved image palette. */
export function migratePaletteSettings(p:PaletteSettings){const old=p as PaletteSettings&{ratio?:unknown;selection?:unknown;top?:unknown};delete old.ratio;delete old.selection;delete old.top;if(['grouped','centered','alternating','alternating-end','paired','mirrored'].includes(p.distribution as string))p.distribution='balanced';}
export function validPaletteSettings(p:PaletteSettings){return (p.repeatMotifs===undefined||typeof p.repeatMotifs==='boolean')&&(p.centerImagePixels===undefined||typeof p.centerImagePixels==='boolean')&&(p.motifCrop===undefined||validMotifCrop(p.motifCrop))&&(p.paleAmount===undefined||Number.isFinite(p.paleAmount)&&p.paleAmount>=0&&p.paleAmount<=.99)&&(p.fillOpacity===undefined||Number.isFinite(p.fillOpacity)&&p.fillOpacity>=0&&p.fillOpacity<=1)&&(p.debugPattern===undefined||typeof p.debugPattern==='boolean')&&(p.inverseOccupation===undefined||typeof p.inverseOccupation==='boolean')&&(p.inverseDistribution===undefined||typeof p.inverseDistribution==='boolean')&&(p.motifOverrides===undefined||!!p.motifOverrides&&typeof p.motifOverrides==='object'&&!Array.isArray(p.motifOverrides)&&Object.entries(p.motifOverrides).length<=PALETTE_COLOR_LIMIT+11&&Object.entries(p.motifOverrides).every(([key,value])=>/^(?:h[0-7]|n[0-2]|#[\da-f]{6})$/i.test(key)&&typeof value==='boolean'))&&(p.distributionAxis===undefined||PALETTE_DISTRIBUTION_AXES.some(([id])=>id===p.distributionAxis))&&(p.progression===undefined||PALETTE_PROGRESSIONS.some(([id])=>id===p.progression))&&(p.distribution===undefined||FOCUS_DISTRIBUTIONS.some(([id])=>id===p.distribution))&&(p.scale===undefined||Number.isFinite(p.scale)&&p.scale>=PALETTE_SCALE.min&&p.scale<=PALETTE_SCALE.max)&&(p.included===undefined||Array.isArray(p.included)&&p.included.length>0&&p.included.length<=PALETTE_COLOR_LIMIT&&new Set(p.included.map(c=>typeof c==='string'?c.toLowerCase():c)).size===p.included.length&&p.included.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c)))&&(p.softness===undefined||Number.isFinite(p.softness)&&p.softness>=.02&&p.softness<=.49)&&(p.balance===undefined||Number.isFinite(p.balance)&&p.balance>=.2&&p.balance<=.8)&&(p.saturation===undefined||Number.isFinite(p.saturation)&&p.saturation>=0&&p.saturation<=PALETTE_SATURATION_MAX)&&(p.layout===undefined||PALETTE_LAYOUTS.some(([id])=>id===p.layout))&&(p.pattern===undefined||p.pattern==='generated'||PALETTE_PATTERNS.some(([id])=>id===p.pattern))&&(p.match===undefined||PALETTE_MATCHES.some(([id])=>id===p.match))&&(p.ink===undefined||PALETTE_INKS.some(([id])=>id===p.ink))&&(p.spread===undefined||PALETTE_SPREADS.some(([id])=>id===p.spread))&&(p.seed===undefined||Number.isInteger(p.seed)&&p.seed>=0&&p.seed<=0xffffffff);}
export function validTextPalette(value:unknown):value is TextPalette{const p=value as TextPalette;return !!p&&typeof p==='object'&&!Array.isArray(p)&&p.mode==='text'&&(p.pixelMotifs===undefined||validPixelMotifs(p.pixelMotifs,p.colors?.length??0))&&(p.field===undefined||validImageField(p.field,p.colors?.length??0))&&(p.available===undefined||Number.isInteger(p.available)&&p.available>=1&&p.available<=PALETTE_COLOR_LIMIT)&&(p.imageRatio===undefined||Array.isArray(p.imageRatio)&&p.imageRatio.length===p.colors?.length&&p.imageRatio.every(n=>Number.isInteger(n)&&n>0)&&p.imageRatio.reduce((a,b)=>a+b,0)<=4096)&&(p.darkSupport===undefined||typeof p.darkSupport==='boolean')&&(p.strength===undefined||Number.isFinite(p.strength)&&p.strength>=.01&&p.strength<=1)&&(p.relations===undefined||validColorRelations(p.relations,p.colors?.length??0))&&validPaletteSettings(p)&&Array.isArray(p.colors)&&p.colors.length>0&&p.colors.length<=PALETTE_COLOR_LIMIT&&p.colors.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))&&(p.pixelSources===undefined||Array.isArray(p.pixelSources)&&p.pixelSources.length===p.colors.length&&p.pixelSources.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c)))&&(p.weights===undefined||Array.isArray(p.weights)&&p.weights.length===p.colors.length&&p.weights.every(w=>Number.isFinite(w)&&w>0&&w<=1));}
export const paletteFillOpacity=(p?:PaletteSettings)=>p?.fillOpacity??1;
export const paletteSpread=(p:PaletteSettings)=>p.spread==='dense'?4:p.spread==='repeat'?2:1;
export const paletteLayout=(p:PaletteSettings)=>PALETTE_LAYOUTS.findIndex(([id])=>id===(p.layout??'horizontal'));
export type PaletteStop={rgb:number[];at:number};
const tables=new WeakMap<TextPalette,PaletteStop[]>();
/** Small, cached stop table is the canonical owner for CSS and world-label gradients. */
function transitionBridge(p:PaletteSettings,a:readonly number[],b:readonly number[]){
 if(p.included?.length){const da=Math.max(...a)-Math.min(...a),db=Math.max(...b)-Math.min(...b),d=Math.abs(colorHue(a)-colorHue(b));if(da>1e-6&&db>1e-6&&Math.min(d,360-d)>1)return p.match==='dark'?[0,0,0]:[1,1,1];return;}
 if(p.match!=='accents'&&p.match!=='dark'&&Math.max(...a)>.999&&Math.max(...b)>.999&&!a.some((c,k)=>c>=.999&&b[k]>=.999))return [1,1,1];
}
/** Included hue families blend through a neutral tone, without inventing a third hue. */
export function mixPaletteRGB(p:PaletteSettings,a:readonly number[],b:readonly number[],t:number){const bridge=p.included?.length?transitionBridge(p,a,b):undefined;if(bridge){if(t<.5){b=bridge;t*=2;}else{a=bridge;t=(t-.5)*2;}}return a.map((v,k)=>v+(b[k]-v)*t);}
export function textPaletteStops(p:TextPalette){let cached=tables.get(p);if(cached)return cached;
 const colors=p.colors.map((color,i)=>({rgb:paletteRGB(color).map(c=>c/255),weight:p.weights?.[i]??1}));
 const total=colors.reduce((sum,c)=>sum+c.weight,0),result:PaletteStop[]=[];let at=0;
 if(p.pattern==='bands'){
  for(const c of colors){result.push({rgb:c.rgb,at});at+=c.weight/total;result.push({rgb:c.rgb,at});}
 }else{
  result.push({rgb:colors[0].rgb,at:0});for(let i=0;i<colors.length-1;i++){const a=colors[i],b=colors[i+1],half=Math.min(a.weight,b.weight)/total*(p.softness??.35);at+=a.weight/total;result.push({rgb:a.rgb,at:at-half});const bridge=transitionBridge(p,a.rgb,b.rgb);if(bridge)result.push({rgb:bridge,at});result.push({rgb:b.rgb,at:at+half});}result.push({rgb:colors.at(-1)!.rgb,at:1});
 }
 tables.set(p,result);return result;
}
export function textPaletteRGB(p:TextPalette,position:number){const stops=textPaletteStops(p),x=Math.max(0,Math.min(1,position));let a=stops[0],rgb=a.rgb;for(let i=1;i<stops.length;i++){const b=stops[i];if(x<b.at){const t=(x-a.at)/Math.max(.000001,b.at-a.at);rgb=a.rgb.map((c,k)=>c+(b.rgb[k]-c)*t);break;}a=b;rgb=b.rgb;}return rgb;}
export function textPalettePair(p:TextPalette,position:number){const rgb=textPaletteRGB(p,position),ink=paletteInk(p);return {color:paletteHex(rgb.map(c=>255*(1-ink+c*ink))),glowColor:paletteHex(rgb.map(c=>c*255))};}
export function textPaletteCSS(p:TextPalette){const period=100/paletteSpread(p),stops=textPaletteStops(p).map(s=>`${paletteHex(s.rgb.map(c=>255*(1-paletteInk(p)+c*paletteInk(p))))} ${s.at*period}%`).join(','),repeat=paletteSpread(p)>1?'repeating-':'';return p.layout==='radial'?`${repeat}radial-gradient(ellipse farthest-corner at center in srgb,${stops})`:`${repeat}linear-gradient(${p.layout==='vertical'?'180deg':p.layout==='diagonal'?'135deg':'90deg'} in srgb,${stops})`;}

export const paletteInk=(p:PaletteSettings)=>Math.min(p.ink==='color'?1:1-palettePaleAmount(p),(p as {strength?:number;darkSupport?:boolean;available?:number;imageRatio?:readonly number[]}).strength??1);

export const palettePaleAmount=(p:PaletteSettings)=>p.paleAmount??.75;
