import {TARGETS,propertyFor,EFFECT_PROPERTIES} from '../composer/runtime/appearance/registry.ts';
import {validateValue} from '../composer/runtime/properties/registry.ts';
import {SPHERE_VISUAL_DEFAULTS} from './sphereVisualDefaults.ts';
import type {Paint} from './visual.ts';
/** V1's real sphere target, excluding the animation channels requested off. */
export const NODE_BODY=TARGETS.find(target=>target.id==='omnium.nodes.body')!;
export const NODE_VISUAL_PROPERTIES=NODE_BODY.properties!.filter(id=>!EFFECT_PROPERTIES.includes(id)).map(id=>propertyFor(id)!);
export type NodePaint=Paint&{brightness?:number;opacity?:number;translucencyRadius?:number};
export const NODE_VISUAL_DEFAULTS={...SPHERE_VISUAL_DEFAULTS,brightness:1};
export function validateNodePaint(paint:NodePaint|undefined){
 if(paint===undefined)return;
 if(!paint||typeof paint!=='object'||Array.isArray(paint))throw Error('Invalid node visual settings.');
 for(const [key,value]of Object.entries(paint)){
  const property=NODE_VISUAL_PROPERTIES.find(property=>property.id===key);
  if(!property||validateValue(property,value)!==value)throw Error(`Invalid node visual ${key}.`);
 }
}
