import type {OperationChoices as Choices} from './operationNumber.ts';
import type {ReactNode} from 'react';
import './operationChoices.css';
/** Shared readable pressed state for single-choice and independent toggles. */
export function OperationToggle({label,selected,onClick,children}:{label:string;selected:boolean;onClick:()=>void;children:ReactNode}){
 return <button className="operation-toggle" type="button" aria-label={label} aria-pressed={selected} onClick={onClick}><span>{children}</span></button>;
}
/** One selected-mode presentation shared by direction and numerical operations. */
export function OperationChoices({choices}:{choices:Choices}){
 return <nav className="operation-choices" aria-label="Mode">{choices.items.map(item=><OperationToggle key={item.id} label={item.label} selected={choices.read()===item.id} onClick={()=>choices.change(item.id)}>{item.symbol==='🞡'?<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-8 0H8M0-8V8M-6-6 6 6M-6 6 6-6"/></svg>:item.symbol}</OperationToggle>)}</nav>;
}
