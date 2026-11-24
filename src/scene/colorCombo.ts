import {extractScenePalette,paletteHex,paletteRGB,colorHue,type ScenePalette} from './palette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;textPalette:string[]};
const lift=(color:string,floor:number)=>{const rgb=paletteRGB(color),max=Math.max(...rgb);return paletteHex(rgb.map(channel=>max?channel*Math.max(1,floor/max):floor));};
const distance=(a:string,b:string)=>{const d=Math.abs(colorHue(paletteRGB(a))-colorHue(paletteRGB(b)));return Math.min(d,360-d);};
/** Image hues share a full-brightness glow and its 25%-saturation text ink. */
export function imageTextPalette(palette:ScenePalette){
 return palette.accents.length?palette.accents.map(({color})=>{const rgb=paletteRGB(color),lo=Math.min(...rgb),span=Math.max(...rgb)-lo,glow=rgb.map(c=>255*(c-lo)/span);return {text:paletteHex(glow.map(c=>255*.75+c*.25)),textGlow:paletteHex(glow)};}):[{text:'#ffffff',textGlow:'#ffffff'}];
}
/** Text/glow share a hue; node roles retain their existing palette selection. */
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 const palette=extractScenePalette(pixels),colors=(palette.accents.length?palette.accents:palette.neutrals).map(item=>item.color);if(!colors.length)throw Error('Image has no visible colours.');
 const backdrop=colors[0],accent=[...colors].sort((a,b)=>distance(b,backdrop)-distance(a,backdrop))[0],others=colors.filter(color=>color!==accent),node=others.find(color=>color!==backdrop&&distance(color,accent)>45)??others[0]??accent;
 const ink=(color:string,brightness:number)=>{if(!palette.accents.length)return lift(color,brightness);const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb),span=hi-lo;if(!span)return lift(color,brightness);const saturation=Math.max(.8,hi?span/hi:0);return paletteHex(rgb.map(channel=>brightness*(1-saturation+saturation*(channel-lo)/span)));};
 const textPalette=imageTextPalette(palette);return {...textPalette[0],textPalette:textPalette.map(stop=>stop.textGlow),node:ink(node,235),nodeGlow:ink(backdrop,255)};
}
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,palette:{mode:'text',colors:combo.textPalette}});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
