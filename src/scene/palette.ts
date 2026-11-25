import type {NativeFieldRef} from '../properties/nativeField.ts';
export const paletteHex=(channels:readonly number[])=>'#'+channels.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const paletteRGB=(color:string)=>[1,3,5].map(at=>parseInt(color.slice(at,at+2),16));
export const colorLuminance=(rgb:readonly number[])=>rgb.reduce((sum,v,i)=>{const c=v/255;return sum+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];},0);
export function colorHue(rgb:readonly number[]){const hi=Math.max(...rgb),lo=Math.min(...rgb),delta=hi-lo;return delta?(((hi===rgb[0]?(rgb[1]-rgb[2])/delta:hi===rgb[1]?2+(rgb[2]-rgb[0])/delta:4+(rgb[0]-rgb[1])/delta)*60+360)%360):0;}
export type SceneTones={background:number;low:number;high:number;darkSupport:boolean};
export type SceneSample={pixels:Uint8ClampedArray;width:number;height:number;native?:Omit<NativeFieldRef,'mapping'>};
export type SceneSignal=Uint8ClampedArray|SceneSample;
/** Keep a bounded spatial grid when the full decoded source is already available. */
export function sampleSceneGrid(pixels:Uint8ClampedArray,width:number,height:number):SceneSample{
 const scale=Math.min(1,Math.sqrt(4096/(width*height))),w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale)),out=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(Math.min(height-1,Math.floor((y+.5)*height/h))*width+Math.min(width-1,Math.floor((x+.5)*width/w)))*4;out.set(pixels.subarray(at,at+4),(y*w+x)*4);}
 return {pixels:out,width:w,height:h};
}
export function paletteFamily(rgb:readonly number[]){const hi=Math.max(...rgb),lo=Math.min(...rgb),hue=colorHue(rgb);if(hi>=210&&lo>=160&&(hi-lo)/hi<.3)return 'n2';return (hi<32||hi===0||(hi-lo)/hi<.18)?`n${hi<64?0:hi<190?1:2}`:`h${hue<15||hue>=345?0:hue<55?1:hue<85?2:hue<165?3:hue<205?4:hue<255?5:hue<290?6:7}`;}
export type ScenePalette={spatial?:{width:number;height:number;families:readonly string[];cells:Uint8Array;rgb?:string;native?:Omit<NativeFieldRef,'mapping'>};tones:SceneTones;accents:{id?:string;color:string;weight:number;salience?:number;meanColor?:string}[];neutrals:{id?:string;color:string;weight:number;salience?:number;meanColor?:string}[]};
/** Count color families together, so many nearby blues cannot displace an orange accent. */
export function extractScenePalette(signal:SceneSignal):ScenePalette{
 const pixels=signal instanceof Uint8ClampedArray?signal:signal.pixels,width=signal instanceof Uint8ClampedArray?pixels.length/4:signal.width,height=signal instanceof Uint8ClampedArray?1:signal.height;
 const families=['h0','h1','h2','h3','h4','h5','h6','h7','n0','n1','n2'],cells=new Uint8Array(pixels.length/4).fill(255);
 const attention=new Map<string,{energy:number;count:number;tiles:Set<number>}>();
 // Neighbor differences capture edges, gradients and recurring color pairings
 // at two small scales. Uniform areas receive no special semantic treatment.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*4;if(pixels[at+3]<13)continue;const rgb=[pixels[at],pixels[at+1],pixels[at+2]],id=paletteFamily(rgb);cells[y*width+x]=families.indexOf(id);let energy=0,count=0;
  for(const offset of [1,4])for(const [dx,dy]of [[offset,0],[0,offset],[-offset,0],[0,-offset]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const other=(ny*width+nx)*4;if(pixels[other+3]<13)continue;energy+=Math.hypot(rgb[0]-pixels[other],rgb[1]-pixels[other+1],rgb[2]-pixels[other+2])/441.673;count++;}
  const value=attention.get(id)??{energy:0,count:0,tiles:new Set<number>()};value.energy+=count?energy/count:0;value.count++;if(energy>0)value.tiles.add(Math.floor(y*8/height)*8+Math.floor(x*8/width));attention.set(id,value);
 }
 const accents=new Map<number,{rgb:number[];weight:number;signal:number[];signalWeight:number}>(),neutrals=new Map<number,{rgb:number[];weight:number;signal:number[];signalWeight:number}>();let total=0,dark=0,light=0,darkSum=0,lightSum=0;const toneWeight=new Float64Array(64),toneSum=new Float64Array(64);
 for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha<.05)continue;const rgb=[pixels[i],pixels[i+1],pixels[i+2]],hi=Math.max(...rgb),lo=Math.min(...rgb),sat=hi?(hi-lo)/hi:0;total+=alpha;const luminance=colorLuminance(rgb),tone=Math.min(63,Math.floor(luminance*64));toneWeight[tone]+=alpha;toneSum[tone]+=luminance*alpha;if(luminance<.035){dark+=alpha;darkSum+=alpha*luminance;}if(luminance>.175){light+=alpha;lightSum+=alpha*luminance;}
  const family=paletteFamily(rgb),bins=family[0]==='n'?neutrals:accents,key=Number(family.slice(1));
  const bin=bins.get(key)??{rgb:[0,0,0],weight:0,signal:[0,0,0],signalWeight:0};for(let c=0;c<3;c++)bin.rgb[c]+=rgb[c]*alpha;bin.weight+=alpha;const signal=alpha*sat**1.5*(.2+.8*Math.sqrt(hi/255));bin.signalWeight+=signal;for(let c=0;c<3;c++)bin.signal[c]+=rgb[c]*signal;bins.set(key,bin);
 }
 const ranked=(bins:typeof accents)=>[...bins.entries()].filter(([,bin])=>bin.weight>=Math.max(1,total*.001)).map(([key,bin])=>{const id=`${bins===accents?'h':'n'}${key}`,signal=attention.get(id);return {id,color:paletteHex((bin.signalWeight?bin.signal.map(v=>v/bin.signalWeight):bin.rgb.map(v=>v/bin.weight))),meanColor:paletteHex(bin.rgb.map(v=>v/bin.weight)),weight:bin.weight/Math.max(1,total),salience:signal?signal.energy/Math.max(1,signal.count)*Math.sqrt(signal.tiles.size):0};}).sort((a,b)=>b.weight-a.weight||a.color.localeCompare(b.color));
 let covered=0,background=0;for(let i=0;i<64;i++){covered+=toneWeight[i];if(covered>=total*.4&&toneWeight[i]){background=toneSum[i]/toneWeight[i];break;}}
 const rgb=Array.from({length:pixels.length/4},(_,i)=>paletteHex([pixels[i*4],pixels[i*4+1],pixels[i*4+2]]).slice(1)).join('');
 return {spatial:{width,height,families,cells,rgb,native:signal instanceof Uint8ClampedArray?undefined:signal.native},accents:ranked(accents),neutrals:ranked(neutrals),tones:{background,low:dark?darkSum/dark:background,high:light?lightSum/light:background,darkSupport:dark/Math.max(1,total)>=.04&&light/Math.max(1,total)>=.15}};
}
/** Compatibility pair for pattern consumers; full palettes remain available to color suggestions. */
export function scenePalette(pixels:Uint8ClampedArray):readonly[string,string]{const palette=extractScenePalette(pixels),colors=[...palette.accents,...palette.neutrals].map(item=>item.color),first=colors[0]??'#32c890',rgb=paletteRGB(first);return [first,colors[1]??paletteHex(rgb.map(v=>Math.max(...rgb)<128?v*.35+165:v*.25))];}

/** Full-size classification retains every source pixel; motif scoring uses the small sample. */
export function classifySceneFamilies(pixels:Uint8ClampedArray){const indices=new Uint8Array(pixels.length/4);for(let i=0;i<indices.length;i++){if(pixels[i*4+3]<13){indices[i]=255;continue;}const family=paletteFamily([pixels[i*4],pixels[i*4+1],pixels[i*4+2]]);indices[i]=(family[0]==='n'?8:0)+Number(family.slice(1));}return indices;}
