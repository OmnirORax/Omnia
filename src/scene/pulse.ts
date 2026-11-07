/** Port of supplied pulse.vert/pulse.frag + common_blending.h, BLENDMODE 9.
 * Band mapping into Wallpaper Engine's undocumented spectrum remains approximate. */
export const PULSE_CONTROLS=[
 {key:'pulseFrequencyMin',label:'First frequency band',initial:0,min:0,max:15,step:1,integer:true},
 {key:'pulseFrequencyMax',label:'Last frequency band',initial:15,min:0,max:15,step:1,integer:true},
 {key:'pulseAudioLow',label:'Audio lower threshold',initial:.01,min:0,max:1,step:.01,integer:false},
 {key:'pulseAudioHigh',label:'Audio upper threshold',initial:1,min:0,max:1,step:.01,integer:false},
 {key:'pulseExponent',label:'Audio exponent',initial:4,min:0,max:4,step:.1,integer:false},
 {key:'pulseAmount',label:'Audio amount',initial:1.2,min:0,max:2,step:.05,integer:false},
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
