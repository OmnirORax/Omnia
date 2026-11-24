import {scenePalette} from './palette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string};
/** Plain ink only. Preserve the sampled hue while lifting very dark accents. */
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 if(!pixels.some((value,index)=>index%4===3&&value>=13))throw Error('Image has no visible colours to suggest.');
 const [primary,secondary]=scenePalette(pixels);
 const lift=(color:string,floor:number)=>{const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),max=Math.max(...rgb);return '#'+rgb.map(channel=>Math.round(max?channel*Math.max(1,floor/max):floor).toString(16).padStart(2,'0')).join('');};
 return {text:lift(primary,220),textGlow:lift(primary,255),node:lift(secondary,180),nodeGlow:lift(secondary,255)};
}
/** The normal appearance owners preserve inheritance, validation and history. */
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){
 writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow});
 writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});
}
