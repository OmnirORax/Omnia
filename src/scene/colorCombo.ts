import {extractScenePalette,paletteHex,paletteRGB,colorLuminance,colorHue} from './palette.ts';
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
 const backgrounds:number[]=[];for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=13)backgrounds.push(colorLuminance([pixels[i],pixels[i+1],pixels[i+2]]));
 const score=(color:string)=>{const light=colorLuminance(paletteRGB(color));return backgrounds.reduce((sum,bg)=>sum+((Math.max(light,bg)+.05)/(Math.min(light,bg)+.05)>=4.5?1:0),0)/backgrounds.length;};
 const bright=lift(accent,235),dark=paletteHex(paletteRGB(accent).map(v=>v*.2)),tint=paletteHex(paletteRGB(accent).map(v=>v*.2+255*.8)),best=[bright,dark,tint].sort((a,b)=>score(b)-score(a))[0],text=score(bright)>=score(best)-.1?bright:best;
 return {text,textGlow:lift(related,255),node:lift(node,180),nodeGlow:lift(backdrop,255)};
}
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
