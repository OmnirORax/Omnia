/** A target adapter declares actual writable inputs, not inferred pixel traits.
 * Applicable operation adapters may combine inputs into one freedom adjuster. */
export type EditableInput={key:string;property:string;label:string;freedom?:{label:string;symbol:string}};
export type EditableTarget={id:string;inputs:readonly EditableInput[]};
export type FreedomAdjuster={id:string;label:string;symbol?:string;adjusts:readonly string[]};
export type EditableDegree={id:string;label:string;symbol?:string;action?:string;properties:readonly string[];targets:readonly {id:string;input:EditableInput}[]};
export function editableDegrees(targets:readonly EditableTarget[],adjusters:readonly FreedomAdjuster[]=[]):EditableDegree[] {
  if(!targets.length)return [];
  const common=[...new Set(targets[0].inputs.map(input=>input.property))].filter(property=>targets.every(target=>target.inputs.some(input=>input.property===property)));
  const used=new Set<string>(),result:EditableDegree[]=[];
  for(const property of common){
    if(used.has(property))continue;
    const adjuster=adjusters.find(candidate=>candidate.adjusts.includes(property)&&candidate.adjusts.every(id=>common.includes(id)));
    const properties=adjuster?.adjusts??[property];properties.forEach(id=>used.add(id));
    const input=targets[0].inputs.find(input=>input.property===property)!;
    result.push({id:adjuster?.id??property,label:input.freedom?.label??adjuster?.label??input.label,
      symbol:adjuster?.symbol??input.freedom?.symbol,action:adjuster?.id,properties,
      targets:targets.flatMap(target=>properties.map(id=>({id:target.id,input:target.inputs.find(input=>input.property===id)!})))});
  }
  return result;
}
