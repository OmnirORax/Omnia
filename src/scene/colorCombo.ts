import {extractScenePalette,paletteHex,paletteRGB,colorHue} from './palette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string};
const lift=(color:string,floor:number)=>{const rgb=paletteRGB(color),max=Math.max(...rgb);return paletteHex(rgb.map(channel=>max?channel*Math.max(1,floor/max):floor));};
const distance=(a:string,b:string)=>{const d=Math.abs(colorHue(paletteRGB(a))-colorHue(paletteRGB(b)));return Math.min(d,360-d);};
/** Fixed roles: contrasting accent text, related glow, a second family for nodes. */
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 const palette=extractScenePalette(pixels),colors=(palette.accents.length?palette.accents:palette.neutrals).map(item=>item.color);if(!colors.length)throw Error('Image has no visible colours.');
 const backdrop=colors[0],accent=[...colors].sort((a,b)=>distance(b,backdrop)-distance(a,backdrop))[0],others=colors.filter(color=>color!==accent),node=others.find(color=>color!==backdrop&&distance(color,accent)>45)??others[0]??accent;
 const related=others.filter(color=>distance(color,accent)<=45).sort((a,b)=>distance(a,accent)-distance(b,accent))[0]??accent;
 const ink=(color:string,brightness:number)=>{if(!palette.accents.length)return lift(color,brightness);const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb),span=hi-lo;if(!span)return lift(color,brightness);const saturation=Math.max(.8,hi?span/hi:0);return paletteHex(rgb.map(channel=>brightness*(1-saturation+saturation*(channel-lo)/span)));};
 return {text:ink(accent,255),textGlow:ink(related,255),node:ink(node,235),nodeGlow:ink(backdrop,255)};
}
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
