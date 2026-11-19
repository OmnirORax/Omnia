import type {MouseEvent} from 'react';
import type {ConfirmedMathValue} from '../../../ui/operationNumber.ts';
import {DialDrawing} from './DialDrawing.tsx';
/** The configured glyph is exactly the live drawing, scaled and noninteractive. */
export function MiniMathematicalValue({value,label,disabled,onClick,formatValue=String,prefix='',configuration,active=false}:{value:number;label:string;disabled?:boolean;onClick:(event:MouseEvent<HTMLButtonElement>)=>void;formatValue?:(n:number)=>string;prefix?:string;configuration?:ConfirmedMathValue;active?:boolean}){
 return <button type="button" className="mathematical-mini-value" disabled={disabled} aria-pressed={active} aria-label={`${label}: ${formatValue(value)}; use main dial`} onClick={onClick}>
  {configuration?.notation?<DialDrawing notation={configuration.notation}/>:<span className="mathematical-mini-unconfigured">{formatValue(value)}</span>}
  {prefix&&<small className="mathematical-mini-prefix">{prefix}</small>}
 </button>;
}
