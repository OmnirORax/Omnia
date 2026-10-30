import type {ReactNode} from 'react';
import {useNumericEditor} from './NumericEditorScope';
import {selectionExpression,type StateSelectionMode} from '../properties/stateSelection';
export type DofSettingsKind='options'|'modes'|'parameters'|'count'|'step'|'reference'|'min'|'max';
export const dofModes:Record<StateSelectionMode,{label:string;icon:string}>={symmetry:{label:'Partitions',icon:'✣'},halving:{label:'Halving',icon:'◐'},step:{label:'Step',icon:'+'}};
export type DofInformationState={label:string;symbol:string;mode:string;modeIcon:string;variable:'count'|'step';expression:ReactNode;reference:string;configure:(kind:DofSettingsKind)=>void;degrees:()=>void};
/** A single inline box keeps grid-based dial buttons from separating base/exponent. */
export function DofRuleExpression({count}:{count:number}){
 const expression=selectionExpression(count);
 return <span className="dof-rule-expression">{expression.base?<>{expression.base}<sup>{expression.power}</sup></>:expression.count}</span>;
}
/** The header and gesture echo share exactly the same information and settings. */
export function DofInformation({information,interactive=true}:{information:DofInformationState;interactive?:boolean}){
 const i=information;
 if(!interactive)return <span className="dof-information-echo">{i.symbol} · {i.modeIcon} {i.expression} · ⟴</span>;
 return <div className="dof-information-controls" aria-label="Active DOF settings" data-ui-control>
  <button type="button" title={`DOF: ${i.label} · choose DOF`} aria-label={`Choose DOF: ${i.label}`} onClick={i.degrees}>{i.symbol}</button>
  <button type="button" title={`${i.mode} · configure · right-click to change mode`} aria-label={`Configure ${i.mode}`} onClick={()=>i.configure('parameters')} onContextMenu={e=>{e.preventDefault();e.stopPropagation();i.configure('modes');}}>{i.modeIcon}</button>
  <button type="button" title="Rule variables" aria-label="Rule variables" onClick={()=>i.configure(i.variable)}>{i.expression}</button>
  <button type="button" title={`Reference: ${i.reference} · change relativity`} aria-label={`Change reference: ${i.reference}`} onClick={()=>i.configure('reference')}>⟴</button>
 </div>;
}
export function DofInformationHeader(){
 const {information}=useNumericEditor();
 if(!information)return null;
 return <div className="dof-information-header"><DofInformation information={information}/></div>;
}
