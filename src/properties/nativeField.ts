/** Native motif geometry is runtime data, never part of workspace snapshots. */
export type NativeFieldRef={key:string;width:number;height:number;mapping:readonly number[];offset?:readonly number[]};
export type NativeFieldSource={width:number;height:number;indices:Uint8Array;revision:number};
const sources=new Map<string,NativeFieldSource>(),pins=new Map<string,number>(),listeners=new Set<()=>void>(),demands=new Set<(key:string)=>void>(),pending=new Set<string>();let revision=0;
const BUDGET=64*1024*1024;
function trim(protectedKey?:string){let bytes=[...sources.values()].reduce((n,s)=>n+s.indices.byteLength,0);for(const [key,source]of sources){if(bytes<=BUDGET)break;if(key===protectedKey||pins.get(key))continue;sources.delete(key);bytes-=source.indices.byteLength;}}
export function nativeFieldSource(key:string){const value=sources.get(key);if(value){sources.delete(key);sources.set(key,value);}return value;}
export function registerNativeField(key:string,width:number,height:number,indices:Uint8Array){if(!Number.isInteger(width)||width<1||width>4096||!Number.isInteger(height)||height<1||height>4096||width*height>12_000_000||indices.length!==width*height)throw Error('Invalid native image dimensions.');pending.delete(key);sources.set(key,{width,height,indices,revision:++revision});trim(key);for(const listener of listeners)listener();}
export function retainNativeField(key:string){pins.set(key,(pins.get(key)??0)+1);if(!sources.has(key)&&!pending.has(key)){pending.add(key);queueMicrotask(()=>{if(!sources.has(key))for(const listener of demands)listener(key);});}return()=>{const count=(pins.get(key)??1)-1;if(count)pins.set(key,count);else{pins.delete(key);pending.delete(key);}trim();};}
export function subscribeNativeFields(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);}
export function validNativeField(value:unknown,colors:number):value is NativeFieldRef{const r=value as NativeFieldRef;return !!r&&typeof r.key==='string'&&/^[\w:.-]{1,160}$/.test(r.key)&&Number.isInteger(r.width)&&r.width>0&&r.width<=4096&&Number.isInteger(r.height)&&r.height>0&&r.height<=4096&&r.width*r.height<=12_000_000&&Array.isArray(r.mapping)&&r.mapping.length===11&&r.mapping.every(c=>Number.isInteger(c)&&c>=-1&&c<colors)&&(r.offset===undefined||Array.isArray(r.offset)&&r.offset.length===2&&r.offset.every(n=>Number.isFinite(n)&&n>=0&&n<1));}
/** Cover semantics: centered crop, with one equal scale on both image axes. */
export function fieldCover(image:{width:number;height:number},bounds:{width:number;height:number}){const scale=Math.max(bounds.width/image.width,bounds.height/image.height),width=image.width*scale,height=image.height*scale;return {width,height,x:(width-bounds.width)/2,y:(height-bounds.height)/2};}

export function subscribeNativeDemand(listener:(key:string)=>void){demands.add(listener);return()=>demands.delete(listener);}

/** GPU form of fieldCover: same equal-axis scale and centered crop. */
export const fieldCoverShader=`vec2 motifCoverUV(vec2 uv,vec2 image,vec2 bounds){vec2 fitted=image*max(bounds.x/image.x,bounds.y/image.y);return (uv-0.5)*bounds/fitted+0.5;}`;
