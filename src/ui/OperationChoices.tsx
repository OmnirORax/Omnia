import type {OperationChoices as Choices} from './operationNumber.ts';
import type {ReactNode} from 'react';
import './operationChoices.css';
/** Shared readable pressed state for single-choice and independent toggles. */
export function OperationToggle({label,selected,onClick,children,onPreview}:{label:string;selected:boolean;onClick:()=>void;children:ReactNode;onPreview?:(active:boolean)=>void}){
 return <button className="operation-toggle" type="button" aria-label={label} aria-pressed={selected} onClick={onClick} onPointerEnter={onPreview?()=>onPreview(true):undefined} onPointerLeave={onPreview?()=>onPreview(false):undefined} onFocus={onPreview?()=>onPreview(true):undefined} onBlur={onPreview?()=>onPreview(false):undefined}><span>{children}</span></button>;
}
/** One selected-mode presentation shared by direction and numerical operations. */
export function OperationChoices({choices,preview}:{choices:Choices;preview?:(id:string|undefined)=>void}){
 return <nav className="operation-choices" aria-label="Mode">{choices.items.map(item=><OperationToggle key={item.id} label={item.label} selected={choices.read()===item.id} onClick={()=>choices.change(item.id)} onPreview={preview?active=>preview(active?item.id:undefined):undefined}>{item.symbol==='🞡'?<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-8 0H8M0-8V8M-6-6 6 6M-6 6 6-6"/></svg>:item.symbol}</OperationToggle>)}</nav>;
}
