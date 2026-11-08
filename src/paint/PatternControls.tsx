import {UIField} from '../ui/UIField.tsx';
import {UISection} from '../ui/UISection.tsx';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties.tsx';
import {useAppearance} from '../appearance/Context.tsx';
import {PATTERN_FIELDS,PATTERN_FUNCTION,patternProperty,patternTile} from './pattern.ts';
export function PatternControls({bindings}:{bindings:PropertyBindings}){
 const paint=useAppearance()?.pattern,tile=paint&&patternTile(paint);
 return <UISection id="shared-pattern-paint" title="Pattern paint" defaultExpanded={false}>
  <p>One editable pattern. Connected text, frames and surfaces inherit its colours and geometry.</p>
  {tile&&<div aria-label="Shared pattern preview" style={{height:48,backgroundImage:tile.url,backgroundSize:`${tile.size}px ${tile.size}px`,border:'1px solid currentColor'}}/>}
  {paint&&<small>{paint.inherited?'Colours inherited from the resting scene image.':paint.settings.source!=='manual'?'No scene palette ready; using the manual fallback pair.':'Manual colour pair.'} Palette: {paint.colors.join(' · ')}</small>}
  {PATTERN_FIELDS.map(field=><UIField key={field.key} id={patternProperty(field.key)} label={field.label} category="Pattern paint"><CoupledField bindings={bindings} consumer={PATTERN_FUNCTION} property={patternProperty(field.key)}/></UIField>)}
  <small>For selective use: Color → Pattern paint → Use shared pattern, then target the desired visual hierarchy sockets. Colour locks and bypasses keep ordinary paint. Borders use their existing contour width; increase it for larger dots.</small>
 </UISection>;
}
