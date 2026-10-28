import type { ReactNode } from 'react';

/** Navigation only. The caller mounts exactly the current registered input and
 * retains values in its existing owner; this component never stores settings. */
export function ProgressiveConfiguration({label,index,count,onBack,onNext,children}: {
  label:string; index:number; count:number; onBack:()=>void; onNext:()=>void; children:ReactNode;
}) {
  return <div className="progressive-configuration" data-configuration-step={index}>
    <small>{label} · {index+1}/{count}</small>
    {children}
    <div className="progressive-navigation">
      <button type="button" onClick={onBack}>Back</button>
      <button type="button" onClick={onNext}>{index+1===count?'Confirm':'Next'}</button>
    </div>
  </div>;
}
