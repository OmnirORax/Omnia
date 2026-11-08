/** Portable, bounded scene correction. Original bytes never enter authored settings. */
export const NORMALIZATION_VERSION=1;
export const NORMALIZATION_FUNCTION='scene.normalize';
export const NORMALIZATION_FIELDS=[
 {key:'enabled',label:'Normalize scene images',kind:'toggle',initial:true},
 {key:'luminanceMin',label:'Luminance minimum',kind:'number',initial:.12,min:0,max:1},
 {key:'luminanceMax',label:'Luminance maximum',kind:'number',initial:.55,min:0,max:1},
 {key:'contrastMin',label:'Contrast minimum',kind:'number',initial:.35,min:0,max:1},
 {key:'contrastMax',label:'Contrast maximum',kind:'number',initial:.98,min:0,max:1},
 {key:'saturationMin',label:'Saturation minimum',kind:'number',initial:.25,min:0,max:1},
 {key:'saturationMax',label:'Saturation maximum',kind:'number',initial:.88,min:0,max:1},
 {key:'balanceTolerance',label:'Neutral colour tolerance',kind:'number',initial:.08,min:0,max:.3},
 {key:'exposureLimit',label:'Maximum exposure correction (EV)',kind:'number',initial:.75,min:0,max:2},
 {key:'contrastLimit',label:'Maximum contrast correction',kind:'number',initial:.25,min:0,max:.75},
 {key:'saturationLimit',label:'Maximum saturation correction',kind:'number',initial:.25,min:0,max:.75},
 {key:'balanceLimit',label:'Maximum neutral colour correction',kind:'number',initial:.06,min:0,max:.2},
] as const;
export type NormalizationPreferences={enabled:boolean;luminanceMin:number;luminanceMax:number;contrastMin:number;contrastMax:number;saturationMin:number;saturationMax:number;balanceTolerance:number;exposureLimit:number;contrastLimit:number;saturationLimit:number;balanceLimit:number};
export const normalizationProperty=(key:string)=>`scene.normalize.${key}`;
export function normalizationPreferences(values:Record<string,unknown>={}):NormalizationPreferences{
 const out:Record<string,number|boolean>={};
 for(const field of NORMALIZATION_FIELDS){const v=values[normalizationProperty(field.key)];out[field.key]=field.kind==='toggle'?typeof v==='boolean'?v:field.initial:typeof v==='number'&&Number.isFinite(v)?Math.max(field.min,Math.min(field.max,v)):field.initial;}
 // A contradictory interval is interpreted as the same unordered pair in all readers.
 for(const name of ['luminance','contrast','saturation']){const a=`${name}Min`,b=`${name}Max`;if(Number(out[a])>Number(out[b]))[out[a],out[b]]=[out[b],out[a]];}
 return out as NormalizationPreferences;
}
export const defaultNormalizationPreferences=()=>normalizationPreferences();
export function normalizationKey(p:NormalizationPreferences){const {enabled:_,...constraints}=p;return JSON.stringify([NORMALIZATION_VERSION,constraints]);}
export type ImageMetrics={luminance:number;contrast:number;saturation:number;balance:number;neutralFraction:number;shadowClipping:number;highlightClipping:number;samples:number};
export type Corrections={exposure:number;contrast:number;saturation:number;balance:number[]};
export type NormalizationReport={before:ImageMetrics;after:ImageMetrics;corrections:Corrections;changed:boolean;unmet:string[];balanceAvailable:boolean;version:number};
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const linear=(v:number)=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
const encoded=(v:number)=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
const LINEAR=Float64Array.from({length:256},(_,i)=>linear(i/255));
const weights=[.2126,.7152,.0722];
const luma=(rgb:readonly number[])=>rgb.reduce((s,v,i)=>s+v*weights[i],0);
export function sampleScenePixels(bytes:Uint8ClampedArray,max=16384){const count=bytes.length/4,step=Math.max(1,Math.ceil(count/max)),out=new Uint8ClampedArray(Math.ceil(count/step)*4);for(let i=0,j=0;i<count;i+=step,j+=4)out.set(bytes.subarray(i*4,i*4+4),j);return out;}
function summarize(bytes:Uint8ClampedArray){
 const histogram=new Float64Array(256),neutrals=[0,0,0];let total=0,mean=0,saturation=0,neutralWeight=0,shadow=0,highlight=0;
 for(let i=0;i<bytes.length;i+=4){const w=bytes[i+3]/255;if(w<.05)continue;const rgb=[bytes[i]/255,bytes[i+1]/255,bytes[i+2]/255],y=luma(rgb),max=Math.max(...rgb),min=Math.min(...rgb),sat=max?(max-min)/max:0;
  total+=w;mean+=y*w;saturation+=sat*w;histogram[Math.round(y*255)]+=w;
  shadow+=rgb.filter(c=>c===0).length*w/3;highlight+=rgb.filter(c=>c===1).length*w/3;
  if(sat<.18&&y>.12&&y<.85){neutralWeight+=w;for(let c=0;c<3;c++)neutrals[c]+=rgb[c]*w;}
 }
 const percentile=(q:number)=>{let sum=0;for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=total*q)return i/255;}return 0;};
 const neutralMean=neutrals.reduce((a,b)=>a+b,0)/3,offsets=neutrals.map(n=>neutralMean?(n-neutralMean)/neutralMean:0);
 return {metrics:{luminance:total?mean/total:0,contrast:total?percentile(.95)-percentile(.05):0,saturation:total?saturation/total:0,balance:Math.max(...offsets.map(Math.abs)),neutralFraction:total?neutralWeight/total:0,shadowClipping:total?shadow/total:0,highlightClipping:total?highlight/total:0,samples:total},offsets,neutralWeight};
}
export const analyzeScenePixels=(bytes:Uint8ClampedArray)=>summarize(bytes).metrics;
const identity=():Corrections=>({exposure:0,contrast:1,saturation:1,balance:[1,1,1]});
export function transformScenePixels(source:Uint8ClampedArray,p:Corrections,out:Uint8ClampedArray=new Uint8ClampedArray(source.length),start=0,end=source.length){
 if(p.exposure===0&&p.contrast===1&&p.saturation===1&&p.balance.every(v=>v===1)){out.set(source.subarray(start,end),start);return out;}
 const exposure=p.exposure*Math.LN2;
 for(let i=start;i<end;i+=4){if(source[i+3]===0){out.set(source.subarray(i,i+4),i);continue;}
  const originalRGB=[0,1,2].map(c=>LINEAR[source[i+c]]),y=luma(originalRGB),balanced=originalRGB.map((v,c)=>v*p.balance[c]),balancedLuma=luma(balanced);
  const rgb=balanced.map(v=>v*(balancedLuma>0?y/balancedLuma:0)),safe=clamp(y,1e-8,1-1e-8);
  const mapped=y<=0?0:y>=1?1:1/(1+Math.exp(-(Math.log(safe/(1-safe))*p.contrast+exposure)));
  const chroma=rgb.map(c=>(c-y)*(y>0?mapped/y:0)*p.saturation);let gamut=1;
  for(const c of chroma)if(c>0)gamut=Math.min(gamut,(1-mapped)/c);else if(c<0)gamut=Math.min(gamut,-mapped/c);
  for(let c=0;c<3;c++){
   // Preserve headroom per channel: never introduce new endpoint clipping when quantizing.
   const value=Math.round(encoded(clamp(mapped+chroma[c]*gamut))*255),original=source[i+c];out[i+c]=clamp(value,original===0?0:1,original===255?255:254);
  }out[i+3]=source[i+3];
 }return out;
}
const gap=(v:number,min:number,max:number)=>v<min?min-v:v>max?v-max:0;
function violations(m:ImageMetrics,p:NormalizationPreferences,balanceAvailable:boolean){return [gap(m.luminance,p.luminanceMin,p.luminanceMax),gap(m.contrast,p.contrastMin,p.contrastMax),gap(m.saturation,p.saturationMin,p.saturationMax),balanceAvailable?Math.max(0,m.balance-p.balanceTolerance):0];}
export function planSceneNormalization(sample:Uint8ClampedArray,p:NormalizationPreferences):NormalizationReport{
 const original=summarize(sample),before=original.metrics,balanceAvailable=before.neutralFraction>=.02&&original.neutralWeight>=32;
 let corrections=identity(),after=before;
 if(p.enabled&&before.samples&&violations(before,p,balanceAvailable).some(v=>v>0)){
  const score=(m:ImageMetrics,c:Corrections)=>violations(m,p,balanceAvailable).reduce((s,v)=>s+v*v,0)+.00005*(c.exposure*c.exposure+(c.contrast-1)**2+(c.saturation-1)**2+c.balance.reduce((s,v)=>s+(v-1)**2,0));
  let best=score(before,corrections);
  const evaluate=(candidate:Corrections)=>{const m=analyzeScenePixels(transformScenePixels(sample,candidate)),s=score(m,candidate);if(s<best-1e-9){best=s;corrections=candidate;after=m;}};
  // Small deterministic bounded coordinate search; every candidate is output-measured.
  for(const scale of [1,.5,.25])for(const axis of ['exposure','contrast','saturation','balance'] as const){
   if(axis==='saturation'&&gap(after.saturation,p.saturationMin,p.saturationMax)===0)continue;
   if(axis==='balance'&&after.balance<=p.balanceTolerance)continue;
   const current={...corrections,balance:[...corrections.balance]};
   for(const sign of [-1,1]){
    const candidate={...current,balance:[...current.balance]};
    if(axis==='balance'){
     if(!balanceAvailable)continue;candidate.balance=original.offsets.map((offset,i)=>clamp(current.balance[i]+sign*(1/(1+offset)-1)*scale,1-p.balanceLimit,1+p.balanceLimit));
    }else{const limit=axis==='exposure'?p.exposureLimit:axis==='contrast'?p.contrastLimit:p.saturationLimit,neutral=axis==='exposure'?0:1;candidate[axis]=clamp(current[axis]+sign*limit*scale,neutral-limit,neutral+limit);}
    evaluate(candidate);
   }
  }
 }
 const unmet=violations(after,p,balanceAvailable).flatMap((v,i)=>v>.005?[['luminance','contrast','saturation','colour balance'][i]]:[]);
 return {before,after,corrections,changed:JSON.stringify(corrections)!==JSON.stringify(identity()),unmet,balanceAvailable,version:NORMALIZATION_VERSION};
}
