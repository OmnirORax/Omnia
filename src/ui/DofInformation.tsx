import type {ReactNode} from 'react';
import {useNumericEditor} from './NumericEditorScope';
import {selectionExpression,type StateSelectionMode} from '../properties/stateSelection';
export type DofSettingsKind='options'|'modes'|'parameters'|'count'|'step'|'reference'|'relation'|'measurements'|'numerator'|'denominator'|'min'|'max';
export const dofModes:Record<StateSelectionMode,{label:string;icon:string}>={symmetry:{label:'Partitions',icon:'✣'},halving:{label:'Halving',icon:'◐'},step:{label:'Step',icon:'+'}};
export function dofModePresentation(mode:StateSelectionMode,cyclic:boolean,use?:'bounds'|'step'|'match'){
 return use==='step'?{label:'Measured step',icon:'Δ'}:use==='match'?{label:'Match',icon:'⨮'}:mode==='symmetry'&&cyclic?{label:'Symmetry',icon:'✣'}:dofModes[mode];
}
export type DofInformationState={label:string;symbol:string;mode:string;modeIcon:string;variable:'count'|'step';expression:ReactNode;reference:string;referenceUse?:'bounds'|'step'|'match';configure:(kind:DofSettingsKind)=>void;degrees:()=>void};
/** A single inline box keeps grid-based dial buttons from separating base/exponent. */
export function DofRuleExpression({count}:{count:number}){
 const expression=selectionExpression(count);
 return <span className="dof-rule-expression">{expression.base?<>{expression.base}<sup>{expression.power}</sup></>:expression.count}</span>;
}
/** Active information stays in the Composer header. */
export function DofInformation({information}:{information:DofInformationState}){
 const i=information;
 return <div className="dof-information-controls" aria-label="Active DOF settings" data-ui-control data-ui-popup-boundary>
  <button data-ui-preserve-title type="button" title={`DOF: ${i.label} · choose DOF`} aria-label={`Choose DOF: ${i.label}`} onClick={i.degrees}>{i.symbol}</button>
  <button data-ui-preserve-title type="button" title={`${i.mode} · configure · right-click to change mode`} aria-label={`Configure ${i.mode}`} onClick={()=>i.configure('parameters')} onContextMenu={e=>{e.preventDefault();e.stopPropagation();i.configure('modes');}}>{i.modeIcon}</button>
  <button data-ui-preserve-title type="button" title="Rule variables" aria-label="Rule variables" onClick={()=>i.configure(i.variable)}>{i.expression}</button>
  <button data-ui-preserve-title type="button" title={`Reference: ${i.reference} · click selects source; right-click configures use`} aria-label={`Change reference: ${i.reference}`} onClick={()=>i.configure('reference')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();i.configure('relation');}}>⟴{i.referenceUse&&<sup className="dof-reference-use">{i.referenceUse==='bounds'?'⊢⊣':i.referenceUse==='step'?'Δ':'⨮'}</sup>}</button>
 </div>;
}
export function DofInformationHeader(){
 const {information}=useNumericEditor();
 if(!information)return null;
 return <div className="dof-information-header"><DofInformation information={information}/></div>;
}
