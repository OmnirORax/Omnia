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


export const FLARE_CONTROLS=[
 {key:'pulsePeakGain',label:'Flare gain',initial:4,min:.25,max:16,step:.05},
 {key:'pulseGlowStrength',label:'Glow strength',initial:6,min:0,max:16,step:.05},
 {key:'pulseGlowReach',label:'Glow reach (%)',initial:4,min:0,max:12,step:.1},
 {key:'pulseGlowTravel',label:'Glow travel (ms)',initial:100,min:75,max:500,step:5},
] as const;
export type FlareKey=typeof FLARE_CONTROLS[number]['key'];
export type FlareField={reach:number;energy:number};

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


/** Byte FFT decode for Automatic's -100..0 dB range. Reused across frames. */
const AUTOMATIC_AMPLITUDES=Float32Array.from({length:256},(_,i)=>i?Math.pow(10,(-100+i/255*100)/20):0);
/** Coherent spectral rises produce finite flares, not a continuously retriggered level. */
export function createAutomaticPulse(){
 const profiles=new Float32Array(2048),histogram=new Float64Array(64);
 const measurement={level:0,change:0};
 const attack=.03,duration=.075;
 const trails=Array.from({length:8},()=>({age:1,peak:0})),fields=Array.from({length:8},()=>({reach:0,energy:0}));let trail=0;
 const gainPeak=(x:number,gain:number)=>gain*x/(1+(gain-1)*x);
 let reference=.25,age=duration,height=0,magnitude=0,start=0,value=0,armed=true;
 const smooth=(t:number)=>t*t*(3-2*t);
 const envelope=()=>age>=duration?0:age<attack?start+(height-start)*smooth(age/attack):height*Math.pow((duration-age)/(duration-attack),2);
 return {
  reset(){reference=.25;age=duration;height=magnitude=start=value=0;armed=true;profiles.fill(0);histogram.fill(0);for(const t of trails){t.age=1;t.peak=0;}},
  /** Pool positive-change energy so one wandering frequency cannot dominate every frame. */
  spectrum(buffer:ArrayLike<number>,channel:number,first:number,last:number,seconds:number){
   const blend=1-Math.exp(-Math.max(1/1000,Math.min(.1,seconds))/.02);
   let energy=0,change=0;
   for(let i=first;i<last;i++){
    const amplitude=AUTOMATIC_AMPLITUDES[buffer[i]],index=channel*1024+i;
    const rise=Math.max(0,amplitude-profiles[index]);
    energy+=amplitude*amplitude;change+=rise*rise;
    profiles[index]+=(amplitude-profiles[index])*blend;
   }
   measurement.level=Math.sqrt(energy);measurement.change=Math.sqrt(change);
   return measurement;
  },
  sample(signal:number,seconds:number,sensitivity:number,amount:number,onset=signal,dropContrast=1,peakGain=4){
   const elapsed=Math.max(0,seconds),dt=Math.min(.1,elapsed);age+=elapsed;for(const t of trails)t.age+=elapsed;value=envelope();
   reference=Math.max(.25,signal*.5,reference*Math.exp(-dt/8));
   let total=0;for(const weight of histogram)total+=weight;
   let sum=0,background=0;
   if(total>0)for(let i=0;i<histogram.length;i++){sum+=histogram[i];if(sum>=total*.5){background=i===0?0:Math.pow(10,(-100+(i+.5)*2)/20);break;}}
   const excess=Math.max(0,onset-background),floor=Math.max(.00005,reference*.04/sensitivity);
   const threshold=background*(1.25+.5/Math.sqrt(sensitivity))+floor;
   if(onset<=background*1.15+floor*.5)armed=true;
   const strongerTail=age>=.04&&age<duration&&value<.35&&excess>magnitude*2.5;
   if(onset>threshold&&((age>=duration&&armed)||strongerTail)){
    start=value;age=0;magnitude=excess;reference=Math.max(reference,excess);
    height=Math.pow(gainPeak(Math.min(1,excess/reference),peakGain),dropContrast);armed=false;
    trail=trails.reduce((oldest,t,i)=>t.age>trails[oldest].age?i:oldest,0);trails[trail].age=0;trails[trail].peak=height;
   }else if(age<attack&&excess>magnitude){
    magnitude=excess;reference=Math.max(reference,excess);height=Math.max(height,Math.pow(gainPeak(Math.min(1,excess/reference),peakGain),dropContrast));trails[trail].peak=height;
   }
   value=envelope();
   const decay=Math.exp(-dt/.6);for(let i=0;i<histogram.length;i++)histogram[i]*=decay;
   const bin=onset>0?Math.max(1,Math.min(63,Math.floor((20*Math.log10(onset)+100)/2))):0;
   histogram[bin]+=Math.max(dt,1/1000);
   return value*amount;
  },
  fields(seconds=.1,amount=1):readonly FlareField[]{
   const rise=Math.min(.04,seconds*.3);
   for(let i=0;i<trails.length;i++){
    const t=trails[i],f=fields[i];
    if(!t.peak||t.age>=seconds){f.reach=f.energy=0;continue;}
    const q=t.age<rise?smooth(t.age/rise):1-smooth((t.age-rise)/(seconds-rise));
    f.reach=q*Math.sqrt(t.peak);f.energy=t.peak*amount*q;
   }
   return fields;
  },
 };
}
