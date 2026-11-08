/** Port of supplied pulse.vert/pulse.frag + common_blending.h, BLENDMODE 9.
 * Band mapping into Wallpaper Engine's undocumented spectrum remains approximate. */
export const PULSE_CONTROLS=[
 {key:'pulseFrequencyMin',label:'First frequency band',initial:14,min:0,max:15,step:1,integer:true},
 {key:'pulseFrequencyMax',label:'Last frequency band',initial:15,min:0,max:15,step:1,integer:true},
 {key:'pulseAudioLow',label:'Audio lower threshold',initial:.01,min:0,max:1,step:.01,integer:false},
 {key:'pulseAudioHigh',label:'Audio upper threshold',initial:1,min:0,max:1,step:.01,integer:false},
 {key:'pulseExponent',label:'Audio exponent',initial:.1,min:0,max:4,step:.1,integer:false},
 {key:'pulseAmount',label:'Audio amount',initial:2,min:0,max:2,step:.05,integer:false},
 {key:'pulseColorWidth',label:'Colour range (°)',initial:30,min:1,max:180,step:1,integer:false},
] as const;
export type PulseKey=typeof PULSE_CONTROLS[number]['key'];
export function referencePulse(bands:ArrayLike<number>,min:number,max:number,low:number,high:number,power:number,amount:number){
 const first=Math.max(0,Math.min(15,Math.round(Math.min(min,max)))),last=Math.max(first,Math.min(15,Math.round(Math.max(min,max))));
 let sum=0;for(let channel=0;channel<2;channel++)for(let band=first;band<=last;band++)sum+=bands[channel*16+band]||0;
 const value=sum/((last-first+1)*2),a=Math.min(low,high),b=Math.max(low,high);
 const x=b>a?Math.max(0,Math.min(1,(value-a)/(b-a))):Number(value>a);
 return Math.max(0,Math.min(1,Math.pow(x*x*(3-2*x),power)))*amount;
}
export const REFERENCE_PULSE_GLSL=`
 vec3 referencePulse(vec3 image,vec3 tintLow,vec3 tintHigh,float pulse){
   vec3 low=image*tintLow,high=image*tintHigh;
   return max(vec3(0.0),mix(low,min(low+high,vec3(1.0)),pulse));
 }`;
/** Prepared numerical reference for the exact supplied blend; pulse may exceed 1. */
export function referencePulseRGB(image:readonly number[],low:readonly number[],high:readonly number[],pulse:number){
 return image.map((v,i)=>{const a=v*low[i],b=Math.min(a+v*high[i],1);return Math.max(0,a+(b-a)*pulse);});
}


export const MAX_PULSE_COLORS=8;
export function pulsePalette(value:unknown):string[]{
 if(typeof value!=='string')return [];
 return [...new Set(value.slice(0,200).split(/[\s,;]+/).filter(c=>/^#[a-f\d]{6}$/i.test(c)).map(c=>c.toLowerCase()))].slice(0,MAX_PULSE_COLORS);
}
/** Union of hue neighbourhoods: overlaps never amplify the pulse twice. */
export function pulseColorWeight(hue:number,saturation:number,palette:readonly {h:number;s:number}[],width:number){
 let weight=0;const outer=Math.max(1,Math.min(180,width))/360,inner=outer*.5;
 const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 for(const c of palette){let d=Math.abs(hue-c.h);d=Math.min(d,1-d);
  weight=Math.max(weight,c.s<.05?1-smooth(.03,.2,saturation):(1-smooth(inner,outer,d))*smooth(.03,.2,saturation));
 }return weight;
}
export const PULSE_COLOUR_GLSL=`
 vec3 displayColour(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));}
 vec3 linearColour(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
 vec3 pulseHSV(vec3 c){
  vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y),e=1.e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);
 }
 vec3 pulseSourceTint(vec3 image){
  float hi=max(image.r,max(image.g,image.b)),lo=min(image.r,min(image.g,image.b));
  vec3 chroma=(image-vec3(lo))/max(hi-lo,.000001);
  return mix(vec3(1.0),chroma,smoothstep(.03,.2,(hi-lo)/max(hi,.000001)));
 }
 uniform int pulseColorMode;uniform int pulsePaletteCount;
 uniform vec3 pulsePalette[${MAX_PULSE_COLORS}];uniform vec3 pulsePaletteRGB[${MAX_PULSE_COLORS}];
 uniform float pulseColorWidth;uniform float pulseAllBrightness;
 vec3 colouredPulse(vec3 image,vec3 low,vec3 high,float pulse){
  if(pulseColorMode==0)return referencePulse(image,low,high,pulse);
  if(pulseColorMode==2)return referencePulse(image,low,pulseSourceTint(image)*pulseAllBrightness,pulse);
  vec3 rest=referencePulse(image,low,high,0.0),source=pulseHSV(image),sum=vec3(0.0);
  float total=0.0,activation=0.0,outer=max(1.0,pulseColorWidth)/360.0;
  for(int i=0;i<${MAX_PULSE_COLORS};i++){
   if(i>=pulsePaletteCount)break;
   vec3 color=pulsePalette[i];float d=abs(source.x-color.x);d=min(d,1.0-d);
   float w=color.y<.05?1.0-smoothstep(.03,.2,source.y):(1.0-smoothstep(outer*.5,outer,d))*smoothstep(.03,.2,source.y);
   // Evaluate each actual tint independently, retaining its RGB/brightness.
   sum+=(referencePulse(image,low,pulsePaletteRGB[i],pulse)-rest)*w;
   total+=w;activation=max(activation,w);
  }
  // Feather/overlap blends complete coloured responses, never a white multiplier.
  return rest+sum/max(total,.000001)*activation;
 }`;

/** Numerical contract for independent coloured responses and source-hue All. */
export function sourcePulseTint(image:readonly number[]):number[]{
 const hi=Math.max(...image),lo=Math.min(...image),s=hi?(hi-lo)/hi:0,t=Math.max(0,Math.min(1,(s-.03)/.17)),w=t*t*(3-2*t);
 return image.map(c=>1-w+w*(c-lo)/Math.max(hi-lo,.000001));
}
export function combinePulseResponses(image:readonly number[],low:readonly number[],colors:readonly {rgb:readonly number[];weight:number}[],pulse:number){
 const rest=referencePulseRGB(image,low,[0,0,0],0),total=colors.reduce((s,c)=>s+c.weight,0),activation=Math.max(0,...colors.map(c=>c.weight));
 const sum=[0,0,0];for(const c of colors){const response=referencePulseRGB(image,low,c.rgb,pulse);for(let i=0;i<3;i++)sum[i]+=(response[i]-rest[i])*c.weight;}
 return rest.map((c,i)=>c+sum[i]/Math.max(total,.000001)*activation);
}
