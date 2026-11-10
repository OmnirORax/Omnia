import {WAVE_CONTROLS,type WaveKey} from './vfx.ts';
import type {Value} from '../appearance/model.ts';
export const WAVE_PRESETS_OWNER='scene.wavePresets';
export type SavedWavePreset={id:string;label:string;waves:boolean;values:Record<WaveKey,number>};
/** Preserve unreadable records and never overwrite them. */
export function readWavePresets(raw:Record<string,Value>|undefined):SavedWavePreset[]{
 return Object.entries(raw??{}).flatMap(([id,value])=>{
  if(!/^preset([3-9]|[1-9]\d)$/.test(id)||typeof value!=='string')return [];
  try {const data:unknown=JSON.parse(value);if(!Array.isArray(data)||data.length!==7||typeof data[0]!=='boolean')return [];
   if(WAVE_CONTROLS.some((c,i)=>typeof data[i+1]!=='number'||!Number.isFinite(data[i+1])||data[i+1]<c.min||data[i+1]>c.max))return [];
   const number=Number(id.slice(6));return [{id,label:`Preset ${number}`,waves:data[0],values:Object.fromEntries(WAVE_CONTROLS.map((c,i)=>[c.key,data[i+1]])) as Record<WaveKey,number>}];
  }catch{return [];}
 }).sort((a,b)=>Number(a.id.slice(6))-Number(b.id.slice(6)));
}
export function appendWavePreset(raw:Record<string,Value>|undefined,waves:boolean,values:Record<WaveKey,number>):Record<string,Value>{
 for(const control of WAVE_CONTROLS){const value=values[control.key];if(!Number.isFinite(value)||value<control.min||value>control.max)throw Error('Invalid wave values.');}
 const id=Array.from({length:97},(_,index)=>`preset${index+3}`).find(key=>!Object.hasOwn(raw??{},key));
 if(!id||Object.keys(raw??{}).length>=100)throw Error('No more wave preset slots are available.');
 return {...raw,[id]:JSON.stringify([waves,...WAVE_CONTROLS.map(c=>values[c.key])])};
}
