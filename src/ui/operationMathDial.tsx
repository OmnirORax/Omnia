import {popupBesideTarget,type PopupRect} from '../composer/runtime/ui/popupPlacement.ts';
import {OperationChoices} from './OperationChoices.tsx';
import {createRoot} from 'react-dom/client';
import {useLayoutEffect,useSyncExternalStore} from 'react';
import {MathematicalDial} from '../composer/runtime/ui/MathematicalDial.tsx';
import {UIHistoryScope} from './useNavigationState.tsx';
import type {OperationNumber,ConfirmedMathValue,OperationChoices as Choices} from './operationNumber.ts';
let sequence=0;
/** An operation lends its actual parameter to the canonical number editor. */
export function mountOperationMathDial(host:HTMLElement,number:OperationNumber,close:()=>void,choices?:Choices,placement?:{target:PopupRect;requested:{x:number;y:number}}){
 const root=createRoot(host),scope=`operation-number:${++sequence}`;
 function View(){useLayoutEffect(()=>{if(!placement)return;const fit=()=>{const bounds=host.getBoundingClientRect(),point=popupBesideTarget(placement.target,bounds,{x:8,y:8,width:Math.max(0,innerWidth-16),height:Math.max(0,innerHeight-16)},placement.requested);host.style.left=`${point.x}px`;host.style.top=`${point.y}px`;};const observer=new ResizeObserver(fit);observer.observe(host);window.addEventListener('resize',fit);fit();return()=>{observer.disconnect();window.removeEventListener('resize',fit);};},[]);useSyncExternalStore(number.subscribe,number.snapshot);let config:ConfirmedMathValue|undefined;
  return <UIHistoryScope.Provider value={scope}><div data-input-owner className="operation-number-dial">
   <MathematicalDial modeControl={choices&&<OperationChoices choices={choices}/>} key={choices?.read()} value={number.value} onSnapChange={number.setSnap} grid={number.grid} scaleStart={number.scaleStart} min={number.min} max={number.max} integer={number.integer} limits={{formatValue:number.formatValue,label:number.label,min:number.min,max:number.max,hardMin:number.hardMin,hardMax:number.hardMax,integer:number.integer,change:number.setLimit}} formatValue={number.formatValue} label={number.label} readoutOwner={number.readoutOwner} keyboardInput onPreview={number.preview} onCancelPreview={number.restore} onConfigurationCommit={next=>{config=next;}} onCommit={value=>{if(number.commit(value,config))queueMicrotask(close);}}/>
  </div></UIHistoryScope.Provider>;
 }
 root.render(<View/>);return()=>{number.restore();root.unmount();};
}
