import { useContextStage, useContextNavigation } from './ContextStage';
import {useRef,type ReactNode} from 'react';

/** Navigation only. The caller mounts exactly the current registered input and
 * retains values in its existing owner; this component never stores settings. */
export function ProgressiveConfiguration({label,index,count,onBack,onNext,children}: {
  label:string; index:number; count:number; onBack:()=>void; onNext:()=>void; children:ReactNode;
}) {
  const root=useRef<HTMLDivElement>(null);
  useContextStage(`${label}:${index}`);
  const shared=useContextNavigation({owner:root,back:onBack,advance:onNext,confirm:onNext});
  return <div ref={root} className="progressive-configuration" data-configuration-step={index}>
    <small>{label} · {index+1}/{count}</small>
    {children}
    {!shared&&<div className="progressive-navigation">
      <button type="button" onClick={onBack}>Back</button>
      <button type="button" onClick={onNext}>{index+1===count?'Confirm':'Next'}</button>
    </div>}
  </div>;
}
