import {colorHue,paletteRGB,paletteHex} from '../scene/palette.ts';
export type TextPalette={mode:'text'|'nodes';colors:readonly string[]};
export function validTextPalette(value:unknown):value is TextPalette{const p=value as TextPalette;return !!p&&typeof p==='object'&&!Array.isArray(p)&&['text','nodes'].includes(p.mode)&&Array.isArray(p.colors)&&p.colors.length>0&&p.colors.length<=8&&p.colors.every(c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c));}
export function paletteStop(color:string){const rgb=paletteRGB(color);return {hue:colorHue(rgb)/360,saturation:Math.max(...rgb)===Math.min(...rgb)?0:1};}
export function textPalettePair(palette:TextPalette,position:number){
 const at=Math.max(0,Math.min(1,position))*(palette.colors.length-1),i=Math.floor(at),a=paletteStop(palette.colors[i]),b=paletteStop(palette.colors[Math.min(i+1,palette.colors.length-1)]),t=at-i,rawDelta=b.hue-a.hue,delta=rawDelta>.5?rawDelta-1:rawDelta<-.5?rawDelta+1:rawDelta,h=(a.hue+delta*t+1)%1,s=a.saturation+(b.saturation-a.saturation)*t;
 const rgb=[5,3,1].map(offset=>{const k=(offset+h*6)%6;return 255*(1-s*Math.max(0,Math.min(k,4-k,1)));});
 return {color:paletteHex(rgb.map(c=>255*.75+c*.25)),glowColor:paletteHex(rgb)};
}
export function textPaletteCSS(palette:TextPalette){return `linear-gradient(90deg in hsl shorter hue,${(palette.colors.length===1?[palette.colors[0],palette.colors[0]]:palette.colors).map(color=>{const p=paletteStop(color);return `hsl(${p.hue*360} ${p.saturation*100}% ${p.saturation?87.5:100}%)`;}).join(',')})`;}
/** One bounded graph pass per paint/world version, never during animation. */
export function paletteProjection(nodes:readonly {position:readonly number[]}[]){
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(const node of nodes)for(let axis=0;axis<3;axis++){low[axis]=Math.min(low[axis],node.position[axis]);high[axis]=Math.max(high[axis],node.position[axis]);}
 const axis=[0,1,2].reduce((best,i)=>high[i]-low[i]>high[best]-low[best]?i:best,0),span=high[axis]-low[axis];return(position:readonly number[])=>span>0?(position[axis]-low[axis])/span:0;
}
