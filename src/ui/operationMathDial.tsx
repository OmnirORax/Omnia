import {createRoot} from 'react-dom/client';
import {useSyncExternalStore} from 'react';
import {MathematicalDial} from '../composer/runtime/ui/MathematicalDial.tsx';
import {UIHistoryScope} from './useNavigationState.tsx';
import type {OperationNumber,ConfirmedMathValue,OperationChoices} from './operationNumber.ts';
let sequence=0;
/** An operation lends its actual parameter to the canonical number editor. */
export function mountOperationMathDial(host:HTMLElement,number:OperationNumber,close:()=>void,choices?:OperationChoices){
 const root=createRoot(host),scope=`operation-number:${++sequence}`;
 function View(){useSyncExternalStore(number.subscribe,number.snapshot);let config:ConfirmedMathValue|undefined;
  return <UIHistoryScope.Provider value={scope}><div data-input-owner className="operation-number-dial">
   {choices&&<nav>{choices.items.map(item=><button key={item.id} type="button" aria-label={item.label} aria-pressed={choices.read()===item.id} onClick={()=>choices.change(item.id)}>{item.symbol}</button>)}</nav>}
   <MathematicalDial value={number.value} min={number.min} max={number.max} integer={number.integer} limits={{label:number.label,min:number.min,max:number.max,hardMin:number.hardMin,hardMax:number.hardMax,integer:number.integer,change:number.setLimit}} label={number.label} readoutOwner={number.readoutOwner} keyboardInput onPreview={number.preview} onCancelPreview={number.restore} onConfigurationCommit={next=>{config=next;}} onCommit={value=>number.commit(value,config)}/>
   <button type="button" className="operation-number-done" onClick={close}>Done</button>
  </div></UIHistoryScope.Provider>;
 }
 root.render(<View/>);return()=>{number.restore();root.unmount();};
}
