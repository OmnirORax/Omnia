import type {Parameter} from './registry.ts';
import type {StateFieldDomain} from '../properties/stateField.ts';
/** Capabilities, never preset/property ID switches, choose a domain projection. */
export function stateFieldDomain(input:Parameter):StateFieldDomain|undefined{
 if(input.kind!=='number'||!Number.isFinite(input.min)||!Number.isFinite(input.max))return;
 return {min:input.min!,max:input.max!,integer:input.integer,resolution:input.step??1,unit:input.unit,quantity:input.measurement??input.property,cyclic:input.selection,
  projection:input.selection?'radial':input.measurement==='center-x'?'axis-x':input.measurement==='center-y'?'axis-y':input.unit==='length'?'axis-x':'radial'};
}
