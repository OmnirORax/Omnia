import {createRoot} from 'react-dom/client';
import {useSyncExternalStore} from 'react';
import {MathematicalDial} from '../composer/runtime/ui/MathematicalDial.tsx';
import {UIHistoryScope} from './useNavigationState.tsx';
import type {OperationNumber,ConfirmedMathValue} from './operationNumber.ts';
let sequence=0;
/** An operation lends its actual parameter to the canonical number editor. */
export function mountOperationMathDial(host:HTMLElement,number:OperationNumber,close:()=>void,choices?:{read:()=>string;items:readonly string[];change:(id:string)=>void}){
 const root=createRoot(host),scope=`operation-number:${++sequence}`;
 function View(){useSyncExternalStore(number.subscribe,number.snapshot);let config:ConfirmedMathValue|undefined;
  return <UIHistoryScope.Provider value={scope}><div data-input-owner className="operation-number-dial">
   {choices&&<nav>{choices.items.map(id=><button key={id} type="button" aria-pressed={choices.read()===id} onClick={()=>choices.change(id)}>{id}</button>)}</nav>}
   <MathematicalDial value={number.value} min={number.min} max={number.max} integer={number.integer} label={number.label} readoutOwner={number.readoutOwner} keyboardInput onPreview={number.preview} onCancelPreview={number.restore} onConfigurationCommit={next=>{config=next;}} onCommit={value=>number.commit(value,config)}/>
   <button type="button" className="operation-number-done" onClick={close}>Done</button>
  </div></UIHistoryScope.Provider>;
 }
 root.render(<View/>);return()=>{number.restore();root.unmount();};
}
