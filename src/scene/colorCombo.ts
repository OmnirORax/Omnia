import {extractScenePalette,paletteHex,paletteRGB,colorLuminance} from './palette.ts';
import {writePaint,paintPreview} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string};
const lift=(color:string,floor:number)=>{const rgb=paletteRGB(color),max=Math.max(...rgb);return paletteHex(rgb.map(channel=>max?channel*Math.max(1,floor/max):floor));};
/** Rank by the fraction of sampled background with readable contrast, not hue popularity. */
export function imageColorCombos(pixels:Uint8ClampedArray){
 const palette=extractScenePalette(pixels),accents=palette.accents.map(item=>item.color),neutrals=palette.neutrals.map(item=>item.color),colors=accents.length?accents:neutrals;
 if(!colors.length)throw Error('Image has no visible colours to suggest.');
 const backgrounds:number[]=[];for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=13)backgrounds.push(colorLuminance([pixels[i],pixels[i+1],pixels[i+2]]));
 const readability=(color:string)=>{const light=colorLuminance(paletteRGB(color));return backgrounds.reduce((sum,bg)=>{const ratio=(Math.max(light,bg)+.05)/(Math.min(light,bg)+.05);return sum+(ratio>=4.5?1:ratio/4.5*.1);},0)/backgrounds.length;};
 const candidates:ImageColorCombo[]=[];
 colors.forEach((color,i)=>{const bright=lift(color,235),dark=paletteHex(paletteRGB(color).map(v=>v*.2)),tint=paletteHex(paletteRGB(color).map(v=>v*.2+255*.8)),ink=[bright,dark,tint].sort((a,b)=>readability(b)-readability(a))[0],glow=lift(colors[(i+1)%colors.length],255),node=lift(colors[(i+2)%colors.length],180),nodeGlow=lift(color,255);
  candidates.push({text:ink,textGlow:glow,node,nodeGlow});
  if(neutrals.length)candidates.push({text:readability('#f4f4f4')>=readability('#111111')?'#f4f4f4':'#111111',textGlow:lift(color,255),node:lift(colors[(i+1)%colors.length],180),nodeGlow:glow});
 });
 const unique=[...new Map(candidates.map(combo=>[JSON.stringify(combo),combo])).values()];return {palette,combos:unique.sort((a,b)=>readability(b.text)-readability(a.text))};
}
export const imageColorCombo=(pixels:Uint8ClampedArray)=>imageColorCombos(pixels).combos[0];
export function previewImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){const origins=origin?[origin]:[];return paintPreview(paintPreview(world,origin?'nodeText':'text',origins,{color:combo.text,glowColor:combo.textGlow}),origin?'nodes':'nodeDefaults',origins,{color:combo.node,glowColor:combo.nodeGlow});}
/** The normal appearance owners preserve inheritance, validation and history. */
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){
 writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow});
 writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});
}
/** A suggestion stays transient until Apply; cancellation always restores current authored work. */
export function createImageComboPreview(host:{read:()=>World;preview:(world:World)=>void;change:(edit:(world:World)=>void)=>void},combos:readonly ImageColorCombo[],origin?:Origin){
 const baseline=host.read();let active=true,index=0;
 const cancel=()=>{if(!active)return;active=false;host.preview(host.read());};
 const valid=()=>{if(!active)return false;if(host.read()!==baseline){cancel();return false;}return true;};
 return {get active(){return active;},get index(){return index;},show(next:number){if(!valid())return false;index=(next%combos.length+combos.length)%combos.length;host.preview(previewImageColorCombo(baseline,combos[index],origin));return true;},apply(){if(!valid())return false;active=false;host.preview(host.read());host.change(world=>applyImageColorCombo(world,combos[index],origin));return true;},cancel};
}
