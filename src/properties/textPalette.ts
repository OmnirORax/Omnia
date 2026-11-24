import {paletteRGB,paletteHex} from '../scene/palette.ts';
export const PALETTE_LAYOUTS=[['horizontal','Horizontal'],['vertical','Vertical'],['diagonal','Diagonal'],['radial','Radial']] as const;
export const PALETTE_PATTERNS=[['smooth','Smooth'],['bands','Bands']] as const;
export const PALETTE_MATCHES=[['motif','Motif'],['light','Accent + white'],['dark','Accent + black'],['palette','Image palette']] as const;
export const PALETTE_INKS=[['pale','Pale text'],['color','Colored text']] as const;
export const PALETTE_SPREADS=[['wide','Wide'],['repeat','Repeat'],['dense','Dense']] as const;
export type PaletteSettings={saturation?:number;layout?:typeof PALETTE_LAYOUTS[number][0];pattern?:typeof PALETTE_PATTERNS[number][0]|'generated';match?:typeof PALETTE_MATCHES[number][0];ink?:typeof PALETTE_INKS[number][0];spread?:typeof PALETTE_SPREADS[number][0];seed?:number};
export type TextPalette=PaletteSettings&{mode:'text';colors:readonly string[];weights?:readonly number[];strength?:number;darkSupport?:boolean};
export const PALETTE_STOP_LIMIT=24;
export function validPaletteSettings(p:PaletteSettings){return (p.saturation===undefined||Number.isFinite(p.saturation)&&p.saturation>=0&&p.saturation<=1)&&(p.layout===undefined||PALETTE_LAYOUTS.some(([id])=>id===p.layout))&&(p.pattern===undefined||p.pattern==='generated'||PALETTE_PATTERNS.some(([id])=>id===p.pattern))&&(p.match===undefined||PALETTE_MATCHES.some(([id])=>id===p.match))&&(p.ink===undefined||PALETTE_INKS.some(([id])=>id===p.ink))&&(p.spread===undefined||PALETTE_SPREADS.some(([id])=>id===p.spread))&&(p.seed===undefined||Number.isInteger(p.seed)&&p.seed>=0&&p.seed<=0xffffffff);}
export function validTextPalette(value:unknown):value is TextPalette{const p=value as TextPalette;return !!p&&typeof p==='object'&&!Array.isArray(p)&&p.mode==='text'&&(p.darkSupport===undefined||typeof p.darkSupport==='boolean')&&(p.strength===undefined||Number.isFinite(p.strength)&&p.strength>=.02&&p.strength<=1)&&validPaletteSettings(p)&&Array.isArray(p.colors)&&p.colors.length>0&&p.colors.length<=8&&p.colors.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c))&&(p.weights===undefined||Array.isArray(p.weights)&&p.weights.length===p.colors.length&&p.weights.every(w=>Number.isFinite(w)&&w>0&&w<=1));}
export const paletteSpread=(p:PaletteSettings)=>p.spread==='dense'?4:p.spread==='repeat'?2:1;
export const paletteLayout=(p:PaletteSettings)=>PALETTE_LAYOUTS.findIndex(([id])=>id===(p.layout??'horizontal'));
export type PaletteStop={rgb:number[];at:number};
const tables=new WeakMap<TextPalette,PaletteStop[]>();
/** Small, cached stop table is the canonical owner for CSS and world-label gradients. */
export function textPaletteStops(p:TextPalette){let cached=tables.get(p);if(cached)return cached;
 const colors=p.colors.map((color,i)=>({rgb:paletteRGB(color).map(c=>c/255),weight:p.weights?.[i]??1}));
 const total=colors.reduce((sum,c)=>sum+c.weight,0),result:PaletteStop[]=[];let at=0;
 if(p.pattern==='bands'){
  for(const c of colors){result.push({rgb:c.rgb,at});at+=c.weight/total;result.push({rgb:c.rgb,at});}
 }else{
  result.push({rgb:colors[0].rgb,at:0});for(let i=0;i<colors.length-1;i++){const a=colors[i],b=colors[i+1],half=Math.min(a.weight,b.weight)/total*.35;at+=a.weight/total;result.push({rgb:a.rgb,at:at-half});if(Math.max(...a.rgb)>.999&&Math.max(...b.rgb)>.999&&!a.rgb.some((c,k)=>c>=.999&&b.rgb[k]>=.999))result.push({rgb:[1,1,1],at});result.push({rgb:b.rgb,at:at+half});}result.push({rgb:colors.at(-1)!.rgb,at:1});
 }
 tables.set(p,result);return result;
}
export function textPaletteRGB(p:TextPalette,position:number){const stops=textPaletteStops(p),x=Math.max(0,Math.min(1,position));let a=stops[0],rgb=a.rgb;for(let i=1;i<stops.length;i++){const b=stops[i];if(x<b.at){const t=(x-a.at)/Math.max(.000001,b.at-a.at);rgb=a.rgb.map((c,k)=>c+(b.rgb[k]-c)*t);break;}a=b;rgb=b.rgb;}return rgb;}
export function textPalettePair(p:TextPalette,position:number){const rgb=textPaletteRGB(p,position),ink=paletteInk(p);return {color:paletteHex(rgb.map(c=>255*(1-ink+c*ink))),glowColor:paletteHex(rgb.map(c=>c*255))};}
export function textPaletteCSS(p:TextPalette){const period=100/paletteSpread(p),stops=textPaletteStops(p).map(s=>`${paletteHex(s.rgb.map(c=>255*(1-paletteInk(p)+c*paletteInk(p))))} ${s.at*period}%`).join(','),repeat=paletteSpread(p)>1?'repeating-':'';return p.layout==='radial'?`${repeat}radial-gradient(ellipse farthest-corner at center in srgb,${stops})`:`${repeat}linear-gradient(${p.layout==='vertical'?'180deg':p.layout==='diagonal'?'135deg':'90deg'} in srgb,${stops})`;}

export const paletteInk=(p:PaletteSettings)=>Math.min(p.ink==='color'?1:.25,(p as {strength?:number;darkSupport?:boolean}).strength??1);
export const THEME_PRESETS:readonly {label:string;settings:PaletteSettings}[]=[{label:'Motif · pale',settings:{match:'motif',ink:'pale',layout:'horizontal',pattern:'smooth',spread:'wide'}},{label:'Motif · color',settings:{match:'motif',ink:'color',layout:'horizontal',pattern:'smooth',spread:'wide'}},{label:'Accent + white',settings:{match:'light',ink:'color',layout:'horizontal',pattern:'smooth',spread:'wide'}},{label:'Accent + black',settings:{match:'dark',ink:'color',layout:'diagonal',pattern:'bands',spread:'wide'}},{label:'Palette · pale',settings:{match:'palette',ink:'pale',layout:'diagonal',pattern:'smooth',spread:'wide'}},{label:'Palette · radial',settings:{match:'palette',ink:'color',layout:'radial',pattern:'smooth',spread:'wide'}},{label:'White bands',settings:{match:'light',ink:'color',layout:'vertical',pattern:'bands',spread:'repeat'}},{label:'Fine motif bands',settings:{match:'motif',ink:'pale',layout:'horizontal',pattern:'bands',spread:'dense'}}];
export const THEME_VARIANTS=THEME_PRESETS.map(p=>p.settings);
export function themePresetIndex(p:PaletteSettings){const resolved={...THEME_VARIANTS[0],...p};return THEME_VARIANTS.findIndex(v=>Object.keys(v).every(key=>v[key as keyof PaletteSettings]===resolved[key as keyof PaletteSettings]));}
export function randomTheme(p:PaletteSettings,darkSupport=false){const current=themePresetIndex(p),eligible=THEME_VARIANTS.filter((v,i)=>i!==current&&(v.match!=='dark'||darkSupport)&&v.match!=='palette'&&!(v.layout==='vertical'&&v.spread!=='wide'));return {...eligible[Math.floor(Math.random()*eligible.length)],saturation:.4+Math.random()*.6};}
/** A new proposal owns its treatment; subsequent manual edits remain available. */
export function generatedTheme(p:PaletteSettings,darkSupport=false){return {match:p.match==='dark'&&!darkSupport||p.match==='light'&&darkSupport||p.match==='palette'?'motif':p.match??'motif',ink:'color',layout:'horizontal',spread:'wide',pattern:'generated',saturation:undefined,seed:Math.floor(Math.random()*0x100000000)} satisfies PaletteSettings;}
