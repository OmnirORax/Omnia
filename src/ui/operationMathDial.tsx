import {OperationChoices} from './OperationChoices.tsx';
import {createRoot} from 'react-dom/client';
import {useSyncExternalStore} from 'react';
import {MathematicalDial} from '../composer/runtime/ui/MathematicalDial.tsx';
import {UIHistoryScope} from './useNavigationState.tsx';
import type {OperationNumber,ConfirmedMathValue,OperationChoices as Choices} from './operationNumber.ts';
let sequence=0;
/** An operation lends its actual parameter to the canonical number editor. */
export function mountOperationMathDial(host:HTMLElement,number:OperationNumber,_close:()=>void,choices?:Choices){
 const root=createRoot(host),scope=`operation-number:${++sequence}`;
 function View(){useSyncExternalStore(number.subscribe,number.snapshot);let config:ConfirmedMathValue|undefined;
  return <UIHistoryScope.Provider value={scope}><div data-input-owner className="operation-number-dial">
   <MathematicalDial modeControl={choices&&<OperationChoices choices={choices}/>} key={choices?.read()} value={number.value} min={number.min} max={number.max} integer={number.integer} limits={{label:number.label,min:number.min,max:number.max,hardMin:number.hardMin,hardMax:number.hardMax,integer:number.integer,change:number.setLimit}} formatValue={number.formatValue} label={number.label} readoutOwner={number.readoutOwner} keyboardInput onPreview={number.preview} onCancelPreview={number.restore} onConfigurationCommit={next=>{config=next;}} onCommit={value=>number.commit(value,config)}/>
  </div></UIHistoryScope.Provider>;
 }
 root.render(<View/>);return()=>{number.restore();root.unmount();};
}
