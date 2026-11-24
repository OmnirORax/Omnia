import {colorLuminance,paletteHex,paletteRGB} from '../scene/palette.ts';
/** Shared positions are the owner of both ink and halo distribution. */
export type TextGradient={stops:{at:number;color:string}[]};
export const GRADIENT_SAMPLES=256;
export const TEXT_KEYLINE='#080b12';
export const GLOW_SATURATION=1.7,GLOW_LUMINOSITY=.62;
export function gradientGlow(rgb:readonly number[]){
 // SVG's saturate matrix uses these coefficients (different from WCAG luminance).
 const y=rgb.reduce((sum,v,i)=>sum+v*[.213,.715,.072][i],0);
 return rgb.map(v=>Math.max(0,Math.min(255,y+(v-y)*GLOW_SATURATION))*GLOW_LUMINOSITY);
}
export function gradientColor(gradient:TextGradient,position:number){
 const stops=gradient.stops;let i=1;while(i<stops.length-1&&stops[i].at<position)i++;
 const a=stops[i-1],b=stops[i],t=Math.max(0,Math.min(1,(position-a.at)/Math.max(1e-9,b.at-a.at)));
 const left=paletteRGB(a.color),right=paletteRGB(b.color);return left.map((v,c)=>v+(right[c]-v)*t);
}
export function gradientPixels(gradient:TextGradient){
 const data=new Uint8Array(GRADIENT_SAMPLES*2*4);
 for(let i=0;i<GRADIENT_SAMPLES;i++){
  const ink=gradientColor(gradient,i/(GRADIENT_SAMPLES-1)),glow=gradientGlow(ink);
  for(let row=0;row<2;row++){const at=(row*GRADIENT_SAMPLES+i)*4;data.set((row?glow:ink).map(Math.round),at);data[at+3]=255;}
 }return data;
}
export const gradientCSS=(gradient:TextGradient)=>`linear-gradient(90deg,${gradient.stops.map(stop=>`${stop.color} ${stop.at*100}%`).join(',')})`;
export function validateTextGradient(value:TextGradient){
 if(!value||!Array.isArray(value.stops)||value.stops.length<2||value.stops.length>24||value.stops[0]?.at!==0||value.stops.at(-1)?.at!==1||value.stops.some((s,i)=>!s||!Number.isFinite(s.at)||s.at<0||s.at>1||i>0&&s.at<=value.stops[i-1].at||!/^#[\da-f]{6}$/i.test(s.color)))throw Error('Invalid text gradient.');
}
/** OKLab hue measures neighboring hue distance perceptually, including purple. */
export function perceptualHue(color:string){
 const [r,g,b]=paletteRGB(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return (Math.atan2(.0259040371*l+.7827717662*m-.808675766*s,1.9779984951*l-2.428592205*m+.4505937099*s)*180/Math.PI+360)%360;
}
/** Lift ink toward a readable luminance, preserving recognizable chromatic hues.
 * A thin contrasting keyline handles local bright patches without frame readback. */
export function gradientInk(color:string){
 const source=paletteRGB(color),hi=Math.max(...source),base=source.map(v=>hi?v/hi*255:0);
 let lo=.28,high=1;
 for(let i=0;i<10;i++){const t=(lo+high)/2,rgb=base.map(v=>v+(255-v)*t);if(colorLuminance(rgb)<.55)lo=t;else high=t;}
 return paletteHex(base.map(v=>v+(255-v)*high));
}
