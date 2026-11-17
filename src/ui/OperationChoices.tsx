import type {OperationChoices as Choices} from './operationNumber.ts';
import './operationChoices.css';
/** One selected-mode presentation shared by direction and numerical operations. */
export function OperationChoices({choices}:{choices:Choices}){
 return <nav className="operation-choices" aria-label="Mode">{choices.items.map(item=><button key={item.id} type="button" aria-label={item.label} aria-pressed={choices.read()===item.id} onClick={()=>choices.change(item.id)}><span>{item.symbol}</span></button>)}</nav>;
}
