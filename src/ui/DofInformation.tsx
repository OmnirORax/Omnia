import type {ReactNode} from 'react';
import {useNumericEditor} from './NumericEditorScope';
import {selectionExpression,type StateSelectionMode} from '../properties/stateSelection';
export type DofSettingsKind='options'|'rule'|'count'|'step'|'reference'|'source'|'relation'|'measurements'|'numerator'|'denominator'|'min'|'max';
export const dofModes:Record<StateSelectionMode,{label:string;icon:string}>={symmetry:{label:'Partitions',icon:'✣'},halving:{label:'Halving',icon:'◐'},step:{label:'Step',icon:'+'}};
export function dofModePresentation(mode:StateSelectionMode,cyclic:boolean,use?:'bounds'|'step'|'match'){
 return use==='step'?{label:'Measured step',icon:'Δ'}:use==='match'?{label:'Match',icon:'⨮'}:mode==='symmetry'&&cyclic?{label:'Symmetry',icon:'✣'}:dofModes[mode];
}
export type DofInformationState={label:string;symbol:string;mode:string;modeIcon:string;variable:'count'|'step';expression:ReactNode;reference:string;referenceSelf:boolean;referenceUse?:'bounds'|'step'|'match';configure:(kind:DofSettingsKind)=>void;degrees:()=>void};
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
  <button data-ui-preserve-title type="button" title={`${i.mode} · configure rule and variables`} aria-label="Configure rule and variables" onClick={()=>i.configure('rule')}>{i.expression}</button>
  <button data-ui-preserve-title type="button" title={`Reference: ${i.reference} · pick reference · right-click configures use`} aria-label={`Change reference: ${i.reference}`} onClick={()=>i.configure('source')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();i.configure('relation');}}>{i.referenceSelf?'↫':'⟴'}{i.referenceUse&&<sup className="dof-reference-use">{i.referenceUse==='bounds'?'⊢⊣':i.referenceUse==='step'?'Δ':'⨮'}</sup>}</button>
 </div>;
}
export function DofInformationHeader(){
 const {information}=useNumericEditor();
 if(!information)return null;
 return <div className="dof-information-header"><DofInformation information={information}/></div>;
}
