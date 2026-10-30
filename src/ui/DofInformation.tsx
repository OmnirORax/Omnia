import type {ReactNode} from 'react';
import {useNumericEditor} from './NumericEditorScope';
import type {StateSelectionMode} from '../properties/stateSelection';
export type DofSettingsKind='options'|'modes'|'parameters'|'count'|'step'|'reference'|'min'|'max';
export const dofModes:Record<StateSelectionMode,{label:string;icon:string}>={symmetry:{label:'Partitions',icon:'✣'},halving:{label:'Halving',icon:'◐'},step:{label:'Step',icon:'+'}};
export type DofInformationState={label:string;symbol:string;mode:string;modeIcon:string;variable:'count'|'step';expression:ReactNode;reference:string;configure:(kind:DofSettingsKind)=>void;degrees:()=>void};
/** The header and gesture echo share exactly the same information and settings. */
export function DofInformation({information,interactive=true}:{information:DofInformationState;interactive?:boolean}){
 const i=information;
 if(!interactive)return <span className="dof-information-echo">{i.symbol} {i.label} · {i.modeIcon} {i.mode} {i.expression} · ⟴ {i.reference}</span>;
 return <div className="dof-information-controls" aria-label="Active DOF settings" data-ui-control>
  <button type="button" title="Choose DOF" onClick={i.degrees}>{i.symbol} {i.label}</button>
  <button type="button" title="Configure mode · right-click to change mode" onClick={()=>i.configure('parameters')} onContextMenu={e=>{e.preventDefault();e.stopPropagation();i.configure('modes');}}>{i.modeIcon} {i.mode}</button>
  <button type="button" title="Rule variables" onClick={()=>i.configure(i.variable)}>{i.expression}</button>
  <button type="button" title="Change relativity" onClick={()=>i.configure('reference')}>⟴ {i.reference}</button>
 </div>;
}
export function DofInformationHeader(){const scope=useNumericEditor();return <div className="dof-information-header">{scope.information?<DofInformation information={scope.information}/>:<span title="Activate a DOF by editing an object">⊕ Position · ✣ Partitions 2³ · ⟴ Self</span>}</div>;}
