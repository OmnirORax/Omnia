import {UISection} from '../ui/UISection.tsx';
import {UIField} from '../ui/UIField.tsx';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties.tsx';
import {NORMALIZATION_FIELDS,NORMALIZATION_FUNCTION,normalizationProperty,type NormalizationReport} from './normalization.ts';
export type NormalizationState={report:NormalizationReport|null;cached:boolean;busy:boolean;error:string;preview?:boolean};
export function NormalizationPanel({bindings,state,showOriginal,onShowOriginal}:{bindings:PropertyBindings;state:NormalizationState;showOriginal:boolean;onShowOriginal:(v:boolean)=>void}){
 const report=state.report;
 return <UISection id="scene-normalization" title="Image normalization" defaultExpanded={false}>
  <UIField id="scene.normalize.enabled" label="Normalize scene images" category="Scene"><CoupledField bindings={bindings} consumer={NORMALIZATION_FUNCTION} property="scene.normalize.enabled" /></UIField>
  <UIField id="scene.normalize.preview" label="Preview original scene" category="Scene"><label><input type="checkbox" checked={showOriginal} onChange={event=>onShowOriginal(event.target.checked)}/>Preview original</label></UIField>
  <p>Compare original and corrected in the world. Original files remain unchanged.</p>
  {state.busy&&<p role="status">Updating image…</p>}{state.error&&<p role="status">{state.error} Using original.</p>}
  {report&&<><p role="status">{report.changed?'Bounded correction':'Already within ranges / no safe improvement'}{state.preview?' · Live preview':''}{state.cached?' · Cached':''}. {report.unmet.length?`Outside preferred ranges: ${report.unmet.join(', ')}.`:'Measured output fits preferred ranges.'}{!report.balanceAvailable?' Not enough neutral pixels for colour-balance correction.':''}</p>
   <table><caption>Measured before → after (0–1)</caption><tbody>{(['luminance','contrast','saturation','balance','shadowClipping','highlightClipping'] as const).map(key=><tr key={key}><th>{{luminance:'Luminance',contrast:'Contrast',saturation:'Saturation',balance:'Neutral colour balance',shadowClipping:'Clipped shadow channels',highlightClipping:'Clipped highlight channels'}[key]}</th><td>{report.before[key].toFixed(3)} → {report.after[key].toFixed(3)}</td></tr>)}</tbody></table></>}
  <UISection id="scene-normalization-ranges" title="Preferred ranges and correction limits" defaultExpanded={false}>
   <p>Ranges apply globally. Reversed endpoints are treated as the same interval. Colour balance uses neutral areas only. Correction limits may leave a target unmet.</p>
   {NORMALIZATION_FIELDS.filter(field=>field.key!=='enabled').map(field=><UIField key={field.key} id={normalizationProperty(field.key)} label={field.label} category="Scene"><CoupledField bindings={bindings} consumer={NORMALIZATION_FUNCTION} property={normalizationProperty(field.key)} /></UIField>)}
  </UISection>
 </UISection>;
}
