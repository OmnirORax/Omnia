const APPEARANCE_EYE_MASK='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M1 12Q12-1 23 12Q12 25 1 12ZM4 12Q12 3 20 12Q12 21 4 12Z"/><path fill-rule="evenodd" d="M19 12a7 7 0 1 0-14 0a7 7 0 1 0 14 0ZM17.5 12a5.5 5.5 0 1 1-11 0a5.5 5.5 0 1 1 11 0Z"/><path d="M12 8a4 4 0 1 1-4 4a2.7 2.7 0 0 0 4-4Z"/></svg>');
/** A target adapter declares actual writable inputs, not inferred pixel traits.
 * Applicable operation adapters may combine inputs into one freedom adjuster. */
export const VISUAL_FREEDOM_GROUP={id:"visual",label:"Appearance",symbol:"👁",symbolMask:APPEARANCE_EYE_MASK} as const;
export const UNIT_FREEDOM_GROUP={id:"units",label:"Units / fill",symbol:"●●"} as const;
export const RELATION_FREEDOM_GROUP={id:"relation",label:"Relations",symbol:"⨮"} as const;
/** Retained export for spatial adapters; both project the same category identity. */
export const POSITION_FREEDOM_GROUP=RELATION_FREEDOM_GROUP;
export type FreedomGroup={id:string;label:string;symbol:string;symbolMask?:string};
export type FreedomPresentation={label:string;symbol:string;symbolOpacity?:number;symbolFill?:string;group?:readonly FreedomGroup[]};
export type EditableInput={key:string;property:string;label:string;freedom?:FreedomPresentation};
export type EditableTarget={id:string;inputs:readonly EditableInput[]};
export type FreedomAdjuster={id:string;label:string;symbol?:string;adjusts:readonly string[]};
export type EditableDegree={id:string;label:string;symbol?:string;symbolOpacity?:number;symbolFill?:string;group?:readonly FreedomGroup[];action?:string;properties:readonly string[];targets:readonly {id:string;input:EditableInput}[]};
export function editableDegrees(targets:readonly EditableTarget[],adjusters:readonly FreedomAdjuster[]=[],coverage:'common'|'available'='common'):EditableDegree[] {
  if(!targets.length)return [];
  const allInputs=targets.flatMap(target=>target.inputs);
  const common=[...new Set((coverage==='available'?allInputs:targets[0].inputs).map(input=>input.property))].filter(property=>coverage==='available'||targets.every(target=>target.inputs.some(input=>input.property===property)));
  const used=new Set<string>(),result:EditableDegree[]=[];
  for(const property of common){
    if(used.has(property))continue;
    const adjuster=adjusters.find(candidate=>candidate.adjusts.includes(property)&&candidate.adjusts.every(id=>common.includes(id)));
    const properties=adjuster?.adjusts??[property];properties.forEach(id=>used.add(id));
    const input=allInputs.find(input=>input.property===property)!;
    result.push({id:adjuster?.id??property,label:input.freedom?.label??adjuster?.label??input.label,
      symbol:adjuster?.symbol??input.freedom?.symbol,symbolOpacity:adjuster?.symbol?undefined:input.freedom?.symbolOpacity,symbolFill:adjuster?.symbol?undefined:input.freedom?.symbolFill,action:adjuster?.id,properties,group:input.freedom?.group,
      targets:targets.flatMap(target=>properties.flatMap(id=>{const input=target.inputs.find(input=>input.property===id);return input?[{id:target.id,input}]:[];}))});
  }
  return result;
}
