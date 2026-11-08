/** Port of supplied pulse.vert/pulse.frag + common_blending.h, BLENDMODE 9.
 * Band mapping into Wallpaper Engine's undocumented spectrum remains approximate. */
export const PULSE_CONTROLS=[
 {key:'pulseFrequencyMin',label:'First frequency band',initial:14,min:0,max:15,step:1,integer:true},
 {key:'pulseFrequencyMax',label:'Last frequency band',initial:15,min:0,max:15,step:1,integer:true},
 {key:'pulseAudioLow',label:'Audio lower threshold',initial:.01,min:0,max:1,step:.01,integer:false},
 {key:'pulseAudioHigh',label:'Audio upper threshold',initial:1,min:0,max:1,step:.01,integer:false},
 {key:'pulseExponent',label:'Audio exponent',initial:.1,min:0,max:4,step:.1,integer:false},
 {key:'pulseAmount',label:'Audio amount',initial:2,min:0,max:2,step:.05,integer:false},
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
 uniform vec3 pulseOmniTint;
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


/** Byte FFT decode for Automatic's -100..0 dB range. Reused across frames. */
const AUTOMATIC_AMPLITUDES=Float32Array.from({length:256},(_,i)=>i?Math.pow(10,(-100+i/255*100)/20):0);
/** Frequency-local rises drive flashes; sustained energy calibrates gain only. */
export function createAutomaticPulse(){
 let range=.03;
 const profiles=new Float32Array(2048),measurement={level:0,change:0,changeLevel:0};
 return {
  reset(){range=.03;profiles.fill(0);},
  /** Reuses one result object. Consume it before reading the other channel. */
  spectrum(buffer:ArrayLike<number>,channel:number,first:number,last:number,seconds:number){
   const blend=1-Math.exp(-Math.max(1/1000,Math.min(.1,seconds))/.02);
   measurement.level=measurement.change=measurement.changeLevel=0;
   for(let i=first;i<last;i++){
    const value=AUTOMATIC_AMPLITUDES[buffer[i]],index=channel*1024+i;
    measurement.level=Math.max(measurement.level,value);
    const rise=value-profiles[index];
    if(rise>measurement.change){measurement.change=rise;measurement.changeLevel=value;}
    profiles[index]+=(value-profiles[index])*blend;
   }
   return measurement;
  },
  sample(signal:number,seconds:number,sensitivity:number,amount:number,onset=signal,onsetLevel=signal){
   const dt=Math.max(0,Math.min(.1,seconds));
   const change=onset;
   // Log sensitivity changes quiet-detail contrast across its full range, not a near-saturated gain.
   const contrast=.8-.25*Math.log2(sensitivity/2);
   const level=onsetLevel;
   const output=level>0&&change>0?Math.pow(level/(level+range),contrast)*Math.min(1,change/level)*amount:0;
   if(signal>0)range+=(Math.max(.01,Math.min(1,signal))-range)*(1-Math.exp(-dt/8));
   return output;
  },
 };
}
