import {extractScenePalette,paletteHex,paletteRGB,colorHue} from './palette.ts';
import {writePaint} from '../core/appearance.ts';
import type {World,Origin} from '../core/model.ts';
import {gradientInk,gradientGlow,perceptualHue,type TextGradient} from '../properties/textGradient.ts';
export type ImageColorCombo={text:string;textGlow:string;node:string;nodeGlow:string;gradient:TextGradient};
const lift=(color:string,floor:number)=>{const rgb=paletteRGB(color),max=Math.max(...rgb);return paletteHex(rgb.map(channel=>max?channel*Math.max(1,floor/max):floor));};
const distance=(a:string,b:string)=>{const d=Math.abs(colorHue(paletteRGB(a))-colorHue(paletteRGB(b)));return Math.min(d,360-d);};
/** Existing body roles and a shared multicolor text distribution from one analysis. */
export function imageColorCombo(pixels:Uint8ClampedArray):ImageColorCombo{
 const palette=extractScenePalette(pixels),colors=(palette.accents.length?palette.accents:palette.neutrals).map(item=>item.color);if(!colors.length)throw Error('Image has no visible colours.');
 const backdrop=colors[0],accent=[...colors].sort((a,b)=>distance(b,backdrop)-distance(a,backdrop))[0],others=colors.filter(color=>color!==accent),node=others.find(color=>color!==backdrop&&distance(color,accent)>45)??others[0]??accent;
 const ink=(color:string,brightness:number)=>{if(!palette.accents.length)return lift(color,brightness);const rgb=paletteRGB(color),hi=Math.max(...rgb),lo=Math.min(...rgb),span=hi-lo;if(!span)return lift(color,brightness);const saturation=Math.max(.8,hi?span/hi:0);return paletteHex(rgb.map(channel=>brightness*(1-saturation+saturation*(channel-lo)/span)));};
 const families=[...palette.accents,...palette.neutrals].map(item=>{
  // Neutral regions retain their coverage and acquire only a trace of the
  // image's dominant chromatic hue, rather than an invented unrelated hue.
  const neutral=palette.neutrals.includes(item),base=gradientInk(item.color),theme=paletteRGB(gradientInk(backdrop));
  const ink=neutral&&palette.accents.length?paletteHex(paletteRGB(base).map((v,i)=>v*.92+theme[i]*.08)):base;
  return {...item,ink,hue:perceptualHue(ink)};
 }).sort((a,b)=>a.hue-b.hue||a.color.localeCompare(b.color));
 // Cutting the largest empty hue arc yields the shortest neighboring hue path.
 let cut=0,gap=-1;for(let i=0;i<families.length;i++){const next=(i+1)%families.length,d=(families[next].hue-families[i].hue+360)%360;if(d>gap){gap=d;cut=next;}}
 const ordered=[...families.slice(cut),...families.slice(0,cut)],total=ordered.reduce((sum,item)=>sum+item.weight,0);
 const stops:TextGradient['stops']=[];let edge=0;
 ordered.forEach((item,i)=>{const width=item.weight/total,previous=ordered[i-1],next=ordered[i+1],left=previous?Math.min(width,previous.weight/total)*.2:0,right=next?Math.min(width,next.weight/total)*.2:0;
  stops.push({at:edge+left,color:item.ink},{at:edge+width-right,color:item.ink});edge+=width;
 });stops[0].at=0;stops.at(-1)!.at=1;
 const text=gradientInk(accent);
 return {text,textGlow:paletteHex(gradientGlow(paletteRGB(text))),node:ink(node,235),nodeGlow:ink(backdrop,255),gradient:{stops}};
}
export function applyImageColorCombo(world:World,combo:ImageColorCombo,origin?:Origin){writePaint(world,origin?'nodeText':'text',origin?[origin]:[],{color:combo.text,glowColor:combo.textGlow,gradient:combo.gradient});writePaint(world,origin?'nodes':'nodeDefaults',origin?[origin]:[],{color:combo.node,glowColor:combo.nodeGlow});}
