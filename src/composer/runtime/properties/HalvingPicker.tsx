import {useContextNavigation} from '../ui/ContextStage';
import { useState,useRef } from 'react';
import { halvedValue } from './halving';
export function HalvingPicker({ low, high, onPick, label = 'Halving', endpointLabels }: {
  low: number; high: number; onPick: (value: number) => void; label?: string; endpointLabels?:readonly [string,string];
}) {
  const root=useRef<HTMLSpanElement>(null);
  const [depth, setDepth] = useState('1'), [stage, setStage] = useState<'depth'|'direction'>('depth');
  const n = Number(depth), valid = depth !== '' && Number.isInteger(n) && n >= 0 && n <= 16;
  const confirm=()=>{if(!valid)return;if(n===1)onPick(halvedValue(low,high,n));else setStage('direction');};
  const shared=useContextNavigation({owner:root,back:stage==='direction'?()=>setStage('depth'):undefined,advance:()=>{if(stage==='depth')confirm();},confirm:()=>{if(stage==='depth')confirm();}});
  return <span ref={root} className="halving-picker" role="group" aria-label={label}>
    {stage==='depth'?<><label>Halvings <input autoFocus aria-label={`${label} depth`} title="Type halving depth; Enter confirms" inputMode="numeric" value={depth} style={{width:36}}
      onChange={event => setDepth(event.target.value)} onFocus={event => event.currentTarget.select()}
      onKeyDown={event => { if (event.key === 'Enter' && valid) { event.preventDefault(); event.stopPropagation(); confirm(); } }} /></label>
      {!shared&&<button type="button" disabled={!valid} onClick={confirm}>{n===1?'Confirm midpoint':'Next'}</button>}</>:<>
      <span>Toward</span>{[false,true].map(upper=><button type="button" key={String(upper)} onClick={()=>onPick(halvedValue(low,high,n,upper))}>{endpointLabels?.[upper?1:0]??String(upper?high:low)}</button>)}
      {!shared&&<button type="button" onClick={()=>setStage('depth')}>Back</button>}
    </>}
  </span>;
}
