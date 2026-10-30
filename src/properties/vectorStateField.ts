import {createReferenceField,type UsedReference} from './referenceUse.ts';
import type {StateFieldDomain} from './stateField.ts';
export type VectorValue=Readonly<Record<string,number>>;
export function sameVector(a:VectorValue,b:VectorValue){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>a[key]===b[key]);}
/** Compose scalar measurement/frame adapters, then validate the tuple atomically. */
export function vectorMatchCandidate(axes:readonly {property:string;domain:StateFieldDomain;reference?:UsedReference;limits?:{min?:number;max?:number}}[],allowed:(value:VectorValue)=>boolean):VectorValue|undefined{
 if(!axes.length)return;
 const value:Record<string,number>={};
 for(const axis of axes){if(!axis.reference||axis.reference.use!=='match')return;
  const field=createReferenceField(axis.domain,{mode:'symmetry',count:1,step:axis.domain.resolution,reference:axis.reference.value,min:axis.limits?.min,max:axis.limits?.max},axis.reference);
  if(field.candidates.length!==1)return;value[axis.property]=field.candidates[0].value;
 }
 return allowed(value)?value:undefined;
}
