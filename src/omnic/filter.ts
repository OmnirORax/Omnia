export type StructuralFilter={text?:string;tags?:string[];collection?:string;generator?:string;operator?:string;countMin?:number;countMax?:number;motion?:boolean;boundary?:boolean;filled?:boolean;parameter?:{property:string;min:number;max:number}};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200;
const name=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=100;
const fail=(message:string):never=>{throw Error(message);};
export function validateFilter(input:unknown):StructuralFilter {
  if(!record(input)||Object.keys(input).some(key=>!['text','tags','collection','generator','operator','countMin','countMax','motion','boundary','filled','parameter'].includes(key)))return fail('Invalid structural filter.');
  for(const key of ['text','collection','generator','operator'] as const)if(input[key]!==undefined&&(typeof input[key]!=='string'||(input[key] as string).length>200))fail('Invalid filter text.');
  for(const key of ['motion','boundary','filled'] as const)if(input[key]!==undefined&&typeof input[key]!=='boolean')fail('Invalid filter state.');
  for(const key of ['countMin','countMax'] as const)if(input[key]!==undefined&&(!Number.isSafeInteger(input[key])||Number(input[key])<0||Number(input[key])>1024))fail('Count filter must be within 0–1024.');
  if(input.countMin!==undefined&&input.countMax!==undefined&&Number(input.countMin)>Number(input.countMax))fail('Minimum count exceeds maximum.');
  if(input.tags!==undefined&&(!Array.isArray(input.tags)||input.tags.length>32||input.tags.some(tag=>!name(tag))))fail('Invalid filter tags.');
  if(input.parameter!==undefined){const p=input.parameter;if(!record(p)||!id(p.property)||typeof p.min!=='number'||!Number.isFinite(p.min)||typeof p.max!=='number'||!Number.isFinite(p.max)||p.min>p.max)fail('Invalid parameter filter.');}
  return input as StructuralFilter;
}
