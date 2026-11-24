export const paletteHex=(channels:readonly number[])=>'#'+channels.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const paletteRGB=(color:string)=>[1,3,5].map(at=>parseInt(color.slice(at,at+2),16));
export const colorLuminance=(rgb:readonly number[])=>rgb.reduce((sum,v,i)=>{const c=v/255;return sum+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];},0);
export type ScenePalette={accents:{color:string;weight:number}[];neutrals:{color:string;weight:number}[]};
/** Count color families together, so many nearby blues cannot displace an orange accent. */
export function extractScenePalette(pixels:Uint8ClampedArray):ScenePalette{
 const accents=new Map<number,{rgb:number[];weight:number}>(),neutrals=new Map<number,{rgb:number[];weight:number}>();let total=0;
 for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha<.05)continue;const rgb=[pixels[i],pixels[i+1],pixels[i+2]],hi=Math.max(...rgb),lo=Math.min(...rgb),delta=hi-lo,sat=hi?delta/hi:0;total+=alpha;
  let hue=delta?(hi===rgb[0]?(rgb[1]-rgb[2])/delta:hi===rgb[1]?2+(rgb[2]-rgb[0])/delta:4+(rgb[0]-rgb[1])/delta)*60:0;hue=(hue+360)%360;
  const neutral=sat<.18||hi<24,bins=neutral?neutrals:accents,key=neutral?(hi<64?0:hi<190?1:2):hue<15||hue>=345?0:hue<55?1:hue<85?2:hue<165?3:hue<205?4:hue<255?5:hue<290?6:7;
  const bin=bins.get(key)??{rgb:[0,0,0],weight:0};for(let c=0;c<3;c++)bin.rgb[c]+=rgb[c]*alpha;bin.weight+=alpha;bins.set(key,bin);
 }
 const ranked=(bins:typeof accents)=>[...bins.values()].filter(bin=>bin.weight>=Math.max(1,total*.005)).map(bin=>({color:paletteHex(bin.rgb.map(v=>v/bin.weight)),weight:bin.weight/Math.max(1,total)})).sort((a,b)=>b.weight-a.weight||a.color.localeCompare(b.color));
 return {accents:ranked(accents),neutrals:ranked(neutrals)};
}
/** Compatibility pair for pattern consumers; full palettes remain available to color suggestions. */
export function scenePalette(pixels:Uint8ClampedArray):readonly[string,string]{const palette=extractScenePalette(pixels),colors=[...palette.accents,...palette.neutrals].map(item=>item.color),first=colors[0]??'#32c890',rgb=paletteRGB(first);return [first,colors[1]??paletteHex(rgb.map(v=>Math.max(...rgb)<128?v*.35+165:v*.25))];}
