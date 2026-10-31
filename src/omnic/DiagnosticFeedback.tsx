import type {Diagnostic} from './evaluate';
import type {Application} from './model';
import {UIAction} from '../ui/UIAction';
/** Same diagnostic actions on the radar and the expanded diagnostic list. */
export function DiagnosticFeedback({diagnostic,operation,onLocate,onRepair}:{diagnostic:Diagnostic;operation?:Application;onLocate:(id:string)=>void;onRepair:(id:string,action:'disable'|'remove')=>void}){
 return <span className="omnic-diagnostic" data-ui-control><span>{diagnostic.message}</span>{operation&&<span className="omnic-diagnostic-actions" role="group" aria-label="Resolve operation warning">
  <UIAction id={`omnic:diagnostic:${operation.id}:locate`} label="Locate operation" symbol="Locate" category="Omnic" onClick={()=>onLocate(operation.id)}/>
  <UIAction id={`omnic:diagnostic:${operation.id}:disable`} label="Disable operation" symbol="Disable" category="Omnic" disabled={!operation.enabled} onClick={()=>onRepair(operation.id,'disable')}/>
  <UIAction id={`omnic:diagnostic:${operation.id}:remove`} label="Remove operation" symbol="Remove" category="Omnic" onClick={()=>onRepair(operation.id,'remove')}/>
 </span>}</span>;
}
