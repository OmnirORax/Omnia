export const RESPONSE_HZ = 60, HISTORY_SECONDS = 8;
const WINDOW=RESPONSE_HZ*HISTORY_SECONDS, PATTERN_AXIS=8, PATTERNS=PATTERN_AXIS*PATTERN_AXIS;
type LegacyCurve=readonly number[];
type LegacyResponse={version:1;light:{loudness:LegacyCurve;recurrence:LegacyCurve};bounce:{loudness:LegacyCurve;recurrence:LegacyCurve}};
export type AudioResponse={version:2;lightMax:number;bounceMax:number;cooldownMs:number;retiredCurves?:LegacyResponse};
const finite=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
function legacy(value:unknown):value is LegacyResponse{
 const v=value as LegacyResponse;
 const curve=(x:unknown):x is LegacyCurve=>Array.isArray(x)&&x.length===16&&x.every(n=>finite(n,0,1));
 return !!v&&v.version===1&&!!v.light&&!!v.bounce&&curve(v.light.loudness)&&curve(v.light.recurrence)&&curve(v.bounce.loudness)&&curve(v.bounce.recurrence);
}
export function validateAudioResponse(value:unknown):asserts value is AudioResponse|LegacyResponse{
 const v=value as AudioResponse;
 if(legacy(value))return;
 if(!v||v.version!==2||!finite(v.lightMax,0,2)||!finite(v.bounceMax,0,.5)||!finite(v.cooldownMs,0,10000)||(v.retiredCurves!==undefined&&!legacy(v.retiredCurves)))throw Error('Unsupported or invalid audio response settings.');
}
export function defaultAudioResponse(light=1.5,bounce=1.15):AudioResponse{
 return{version:2,lightMax:Math.max(0,Math.min(2,light)),bounceMax:Math.max(0,Math.min(.5,Math.round((bounce-1)*1000)/1000)),cooldownMs:300};
}
export function audioResponse(value:unknown,light?:number,bounce?:number):AudioResponse{
 if(value===undefined)return defaultAudioResponse(light,bounce);
 validateAudioResponse(value);
 if(value.version===1)return{version:2,lightMax:2*Math.max(...value.light.loudness)*Math.max(...value.light.recurrence),bounceMax:.5*Math.max(...value.bounce.loudness)*Math.max(...value.bounce.recurrence),cooldownMs:1000,retiredCurves:structuredClone(value)};
 return{...value,...(value.retiredCurves?{retiredCurves:structuredClone(value.retiredCurves)}:{})};
}
/** Reused measurement storage; waveform crossings and crest distinguish coarse patterns without FFT. */
export function createAudioMeasurement(){
 const result={rms:0,pattern:0};
 return(channels:readonly Float32Array[],sampleRate:number)=>{
  let sum=0,count=0,peak=0,crossings=0,intervals=0;
  for(const channel of channels){
   for(let i=0;i<channel.length;i++){const v=channel[i];sum+=v*v;peak=Math.max(peak,Math.abs(v));if(i&&((v>=0)!==(channel[i-1]>=0)))crossings++;}
   count+=channel.length;intervals+=Math.max(0,channel.length-1);
  }
  result.rms=count?Math.sqrt(sum/count):0;
  const hz=intervals?crossings/intervals*sampleRate/2:0;
  const band=Math.max(0,Math.min(7,Math.floor(Math.log2(Math.max(1,hz/55))))),crest=result.rms?peak/result.rms:1;
  const shape=Math.max(0,Math.min(7,Math.floor((crest-1)*2)));
  result.pattern=band*PATTERN_AXIS+shape;return result;
 };
}
/** Smooth rise and rounded return, with zero slope at each end and the peak. */
export const ATTACK_SECONDS=.06, RELEASE_SECONDS=.24;
export function pulseValue(from:number,peak:number,age:number){
 if(age<0||!Number.isFinite(age))return 0;
 if(age<ATTACK_SECONDS){const x=age/ATTACK_SECONDS;return from+(peak-from)*x*x*(3-2*x);}
 const x=Math.min(1,(age-ATTACK_SECONDS)/RELEASE_SECONDS);return peak*(1-x*x*(3-2*x));
}
/** Fixed storage, per-pattern accepted timestamps, and a recent peak reference. */
export function createAudioResponse(initial=defaultAudioResponse()){
 let settings=initial,slot=-1,cursor=0,peak=0,previous=0;
 const levels=new Float64Array(WINDOW),lastReaction=new Float64Array(PATTERNS).fill(-Infinity);
 const result={intensity:0,light:0,bounce:0,reacted:false};
 const pulses={light:{at:-Infinity,from:0,peak:0},bounce:{at:-Infinity,from:0,peak:0}};
 function read(now:number){result.light=Math.min(settings.lightMax,pulseValue(pulses.light.from,pulses.light.peak,now-pulses.light.at));result.bounce=Math.min(settings.bounceMax,pulseValue(pulses.bounce.from,pulses.bounce.peak,now-pulses.bounce.at));return result;}
 function clearLevels(){levels.fill(0);cursor=0;peak=0;previous=0;}
 function reset(){clearLevels();lastReaction.fill(-Infinity);for(const p of [pulses.light,pulses.bounce]){p.at=-Infinity;p.from=p.peak=0;}slot=-1;result.intensity=result.light=result.bounce=0;result.reacted=false;}
 function insert(level:number){
  const expired=levels[cursor];levels[cursor]=level;cursor=(cursor+1)%WINDOW;
  if(level>=peak)peak=level;
  else if(expired>=peak){peak=0;for(let i=0;i<WINDOW;i++)peak=Math.max(peak,levels[i]);}
 }
 return{
  result,reset,read,
  due(now:number){return Number.isFinite(now)&&Math.floor(now*RESPONSE_HZ+1e-6)!==slot;},
  configure(value:AudioResponse){
   for(const key of ['light','bounce'] as const){
    const before=key==='light'?settings.lightMax:settings.bounceMax,after=key==='light'?value.lightMax:value.bounceMax;
    if(before!==after){const scale=before?after/before:0;pulses[key].from*=scale;pulses[key].peak*=scale;result[key]*=scale;}
   }
   settings=value;
  },
  sample(rms:number,now:number,pattern=0){
   if(!Number.isFinite(now)||now<0)return result;
   const next=Math.floor(now*RESPONSE_HZ+1e-6);if(next===slot)return result;
   if(slot>=0&&next<slot)reset();
   if(slot>=0&&next-slot>=WINDOW)clearLevels();
   else if(slot>=0)for(let i=slot+1;i<next;i++)insert(0);
   slot=next;result.reacted=false;
   const amplitude=Number.isFinite(rms)?Math.max(0,Math.min(1,rms)):0;
   insert(amplitude);result.intensity=peak>0?amplitude/peak:0;
   read(now);
   const rising=amplitude-previous>1e-7;previous=amplitude;
   if(rising&&(settings.lightMax>0||settings.bounceMax>0)){
    const index=Number.isFinite(pattern)?Math.max(0,Math.min(PATTERNS-1,Math.floor(pattern))):0;
    const band=Math.floor(index/PATTERN_AXIS),shape=index%PATTERN_AXIS;
    let accepted=-Infinity;
    for(let a=Math.max(0,band-1);a<=Math.min(7,band+1);a++)for(let b=Math.max(0,shape-1);b<=Math.min(7,shape+1);b++)accepted=Math.max(accepted,lastReaction[a*PATTERN_AXIS+b]);
    if(now-accepted+1e-9>=settings.cooldownMs/1000){
     lastReaction[index]=now;result.reacted=true;
     for(const key of ['light','bounce'] as const){
      const maximum=key==='light'?settings.lightMax:settings.bounceMax,target=result.intensity*maximum;
      if(target>result[key]){pulses[key].at=now;pulses[key].from=result[key];pulses[key].peak=target;}
     }
    }
   }
   if(result.light<1e-7)result.light=0;if(result.bounce<1e-7)result.bounce=0;
   return result;
  },
 };
}
