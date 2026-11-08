import NormalizationWorker from './normalization.worker?worker&inline';
import {sampleScenePixels,normalizationKey,type NormalizationPreferences,type NormalizationReport} from './normalization.ts';
type Cached={key:string;blob:Blob;report:NormalizationReport;touched:number};
// Bounded source samples keep drag solving consistent with full-size correction.
const samples=new Map<string,Uint8ClampedArray>();
const MAX_CACHE_BYTES=32*1024*1024,MAX_CACHE_IMAGES=8;
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('omnium-scene-normalization',1);request.onupgradeneeded=()=>request.result.createObjectStore('results',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function cacheRead(key:string){const db=await database();try{return await new Promise<Cached|undefined>((resolve,reject)=>{const transaction=db.transaction('results','readwrite'),store=transaction.objectStore('results'),request=store.get(key);let value:Cached|undefined;request.onsuccess=()=>{value=request.result;if(value)store.put({...value,touched:Date.now()});};transaction.oncomplete=()=>resolve(value);transaction.onerror=transaction.onabort=()=>reject(transaction.error);});}finally{db.close();}}
async function cacheWrite(value:Cached){if(value.blob.size>MAX_CACHE_BYTES)return;const db=await database();try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('results','readwrite'),store=transaction.objectStore('results'),request=store.getAll();request.onsuccess=()=>{const entries=(request.result as Cached[]).filter(e=>e.key!==value.key).sort((a,b)=>b.touched-a.touched);let size=value.blob.size,count=1;for(const entry of entries){size+=entry.blob.size;count++;if(size>MAX_CACHE_BYTES||count>MAX_CACHE_IMAGES)store.delete(entry.key);}store.put(value);};transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error);});}finally{db.close();}}
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Normalization cancelled.','AbortError');};
type WorkerResult={pixels:Uint8ClampedArray;report:NormalizationReport};
/** One serial processor per display session; ownership/cancellation stays with its caller. */
export function createNormalizationProcessor(){
 let worker:Worker|null=null,closed=false,pending:(()=>void)|null=null;
 return {
  process(pixels:Uint8ClampedArray,preferences:NormalizationPreferences,sample:Uint8ClampedArray,signal?:AbortSignal){
   return new Promise<WorkerResult>((resolve,reject)=>{
    if(closed||signal?.aborted){reject(new DOMException('Normalization cancelled.','AbortError'));return;}
    if(pending){reject(new Error('Normalization processor is already in use.'));return;}
    worker??=new NormalizationWorker();
    const cleanup=()=>{pending=null;signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{cleanup();worker?.terminate();worker=null;reject(new DOMException('Normalization cancelled.','AbortError'));};pending=cancel;
    worker.onmessage=event=>{cleanup();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data);};
    worker.onerror=()=>{cleanup();worker?.terminate();worker=null;reject(new Error('Image normalization could not run. The original remains available.'));};
    signal?.addEventListener('abort',cancel,{once:true});worker.postMessage({pixels,preferences,sample},[pixels.buffer]);
   });
  },
  dispose(){closed=true;pending?.();worker?.terminate();worker=null;},
 };
}
type NormalizationOptions={signal?:AbortSignal;persistent?:boolean;preview?:boolean;processor?:ReturnType<typeof createNormalizationProcessor>};
export async function normalizeSceneBlob(original:Blob,preferences:NormalizationPreferences,{signal,persistent=true,preview=false,processor}:NormalizationOptions={}):Promise<{blob:Blob;report:NormalizationReport;cached:boolean}>{
 persistent=persistent&&!preview;
 aborted(signal);
 const digest=await crypto.subtle.digest('SHA-256',await original.arrayBuffer());
 const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join(''),key=`${hash}:${preferences.enabled}:${normalizationKey(preferences)}`;
 aborted(signal);
 // Cached derivatives are optional. Storage failure never prevents using the source.
 const cached=persistent?await cacheRead(key).catch(()=>undefined):undefined;aborted(signal);if(cached)return {blob:cached.report.changed?cached.blob:original,report:cached.report,cached:true};
 const cachedSample=samples.get(hash);
 if(preview&&cachedSample){const owned=processor?null:createNormalizationProcessor();try{const result=await (processor??owned!).process(cachedSample.slice(),preferences,cachedSample,signal);aborted(signal);return {blob:original,report:result.report,cached:false};}finally{owned?.dispose();}}
 const image=await createImageBitmap(original);try{
  aborted(signal);if(image.width>4096||image.height>4096||image.width*image.height>12_000_000)throw new Error('Scene exceeds the normalization resolution limit.');
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Image processing is unavailable.');context.drawImage(image,0,0,canvas.width,canvas.height);
  const input=context.getImageData(0,0,canvas.width,canvas.height);
  const sample=samples.get(hash)??sampleScenePixels(input.data);
  samples.delete(hash);samples.set(hash,sample);if(samples.size>8)samples.delete(samples.keys().next().value!);

  const owned=processor?null:createNormalizationProcessor();let result:WorkerResult;
  try{result=await (processor??owned!).process(preview?sample.slice():input.data,preferences,sample,signal);}finally{owned?.dispose();}aborted(signal);
  if(result.report.changed&&!preview)context.putImageData(new ImageData(new Uint8ClampedArray(result.pixels),canvas.width,canvas.height),0,0);
  // Live rendering uses the original full-resolution texture plus these coefficients.
  if(preview)return {blob:original,report:result.report,cached:false};
  let blob=original;
  if(result.report.changed)blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Corrected image could not be encoded.')),'image/png'));
  aborted(signal);if(persistent)await cacheWrite({key,blob:result.report.changed?blob:new Blob(),report:result.report,touched:Date.now()}).catch(()=>{});aborted(signal);
  return {blob,report:result.report,cached:false};
 }finally{image.close();}
}

/** Delete all disposable derivatives of a removed local source, across preference revisions. */
export async function forgetNormalizedScene(original:Blob){
 const digest=await crypto.subtle.digest('SHA-256',await original.arrayBuffer()),prefix=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')+':';
 samples.delete(prefix.slice(0,-1));
 const db=await database();try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('results','readwrite'),store=transaction.objectStore('results'),request=store.getAllKeys();request.onsuccess=()=>{for(const key of request.result)if(String(key).startsWith(prefix))store.delete(key);};transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error);});}finally{db.close();}
}
