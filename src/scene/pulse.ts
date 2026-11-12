/** Port of supplied pulse.vert/pulse.frag + common_blending.h, BLENDMODE 9.
 * Band mapping into Wallpaper Engine's undocumented spectrum remains approximate. */
export const PULSE_CONTROLS=[
 {key:'pulseFrequencyMin',label:'First frequency band',initial:14,min:0,max:15,step:1,integer:true},
 {key:'pulseFrequencyMax',label:'Last frequency band',initial:15,min:0,max:15,step:1,integer:true},
 {key:'pulseAudioLow',label:'Audio lower threshold',initial:.01,min:0,max:1,step:.01,integer:false},
 {key:'pulseAudioHigh',label:'Audio upper threshold',initial:1,min:0,max:1,step:.01,integer:false},
 {key:'pulseExponent',label:'Audio exponent',initial:.1,min:0,max:4,step:.1,integer:false},
 {key:'pulseAmount',label:'Audio amount',initial:1.7,min:0,max:2,step:.05,integer:false},
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
/** Archived from the superseded separate-slider preview; never rendered or edited. */
export const RETIRED_OMNI_BRIGHTNESS_CONTROLS=[
 {key:'pulseOmniLowBrightness',label:'Base brightness',initial:.5,min:0,max:2,step:.01},
 {key:'pulseOmniHighBrightness',label:'Flash brightness',initial:1.5,min:0,max:4,step:.01},
] as const;
export type RetiredOmniBrightnessKey=typeof RETIRED_OMNI_BRIGHTNESS_CONTROLS[number]['key'];
export const PULSE_COLOUR_GLSL=`
 vec3 displayColour(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));}
 vec3 linearColour(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
 #if PULSE_ALL_COLORS
 vec3 pulseSourceTint(vec3 image){
  float hi=max(image.r,max(image.g,image.b)),lo=min(image.r,min(image.g,image.b));
  float delta=hi-lo;
  return delta>.000001?(image-vec3(lo))/delta:vec3(1.0);
 }
 uniform vec3 pulseOmniTint;uniform vec3 pulseOmniTintLow;
 vec3 omniHighTint(vec3 image,vec3 control){
  float value=max(control.r,max(control.g,control.b));
  float saturation=value>0.0?1.0-min(control.r,min(control.g,control.b))/value:0.0;
  return mix(vec3(1.0),pulseSourceTint(image),saturation)*value;
 }
 #endif
`;
/** Numerical contract for independent coloured responses and source-hue All. */
export function sourcePulseTint(image:readonly number[]):number[]{
 const hi=Math.max(...image),lo=Math.min(...image),delta=hi-lo;
 return image.map(c=>delta>.000001?(c-lo)/delta:1);
}

/** Normal HSV saturation/value, with hue supplied independently by each image region. */
export function omniHighTintRGB(image:readonly number[],control:readonly number[]){
 const value=Math.max(...control),saturation=value?1-Math.min(...control)/value:0;
 return sourcePulseTint(image).map(c=>(1-saturation+saturation*c)*value);
}


/** Archived rollback preferences; no active UI, gain or glow renderer. */
export const RETIRED_FLARE_CONTROLS=[
 {key:'pulsePeakGain',label:'Flare gain',initial:4,min:.25,max:16,step:.05},
 {key:'pulseGlowStrength',label:'Glow strength',initial:6,min:0,max:16,step:.05},
 {key:'pulseGlowReach',label:'Glow reach (%)',initial:4,min:0,max:12,step:.1},
 {key:'pulseGlowTravel',label:'Glow travel (ms)',initial:100,min:75,max:500,step:5},
] as const;
export type RetiredFlareKey=typeof RETIRED_FLARE_CONTROLS[number]['key'];
