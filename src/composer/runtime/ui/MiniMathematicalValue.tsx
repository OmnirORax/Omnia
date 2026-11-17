import type {ConfirmedMathValue} from '../../../ui/operationNumber.ts';
import type {MouseEvent} from 'react';
import {dialRingSlots} from './DialSlots.tsx';
import {dialValueGrid,dialGridCount,type DialValueGrid} from '../../../properties/dialValueGrid.ts';
/** A compact view of the same value/count, not another number-input implementation. */
export function MiniMathematicalValue({value,min,max,integer,label,disabled,onClick,formatValue=String,prefix='',grid,configuration}:{value:number;min:number;max:number;integer?:boolean;label:string;disabled?:boolean;onClick:(event:MouseEvent<HTMLButtonElement>)=>void;formatValue?:(n:number)=>string;prefix?:string;grid?:DialValueGrid;configuration?:ConfirmedMathValue}){
 const count=configuration?.count??dialGridCount(grid??dialValueGrid({min,max,integer}),value),index=Math.abs(count)-1;
 return <button type="button" className="mathematical-mini-value" disabled={disabled} aria-label={`${label}: ${value}; open dial`} onClick={onClick}>
  <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor"/>{dialRingSlots(0,15,8,3,40,count>=0).map(slot=><circle key={slot.key} cx={20+slot.x} cy={20+slot.y} r="1.5" fill={count&&slot.index===index%8?'currentColor':'none'} stroke="currentColor" strokeWidth=".5"/>)}</svg>
  <span>{prefix}{formatValue(value)}</span>
 </button>;
}
