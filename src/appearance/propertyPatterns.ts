import type { PropertyValue } from '../properties/registry';
export type PatternObject = { id:string; values:Record<string,PropertyValue> };
export type PropertyCriterion = { property:string; value:PropertyValue; exclude?:boolean; tolerance?:number; period?:number };
export function criterionMatches(object:PatternObject, rule:PropertyCriterion) {
  const actual=object.values[rule.property];
  if(actual===undefined)return false;
  if(typeof actual==='number'&&typeof rule.value==='number') {
    let diff=Math.abs(actual-rule.value);
    if(rule.period) {diff%=rule.period;diff=Math.min(diff,rule.period-diff);}
    return diff<=(rule.tolerance??1e-7);
  }
  return actual===rule.value;
}
export const matchingProperties=(objects:readonly PatternObject[],rules:readonly PropertyCriterion[])=>objects.filter(object=>rules.every(rule=>criterionMatches(object,rule)!==!!rule.exclude)).map(object=>object.id);
/** Renderer adapters expose actual properties. Absolute position is excluded by
 * the adapter; no pixel/color inference or second property inventory is needed. */
export function rankedPropertyPatterns(objects:readonly PatternObject[],target:PatternObject) {
  const keys=Object.keys(target.values);
  return keys.map(property=>{
    const rule={property,value:target.values[property]},members=objects.filter(object=>criterionMatches(object,rule));
    const score=members.length?members.reduce((sum,object)=>sum+keys.filter(key=>criterionMatches(object,{property:key,value:target.values[key]})).length,0)/members.length/Math.max(1,keys.length):0;
    return {rule,ids:members.map(object=>object.id),score};
  }).sort((a,b)=>b.score-a.score||a.ids.length-b.ids.length||a.rule.property.localeCompare(b.rule.property));
}
