import { useState } from 'react';
import { halvedValue } from './halving';
export function HalvingPicker({ low, high, onPick, label = 'Halving' }: {
  low: number; high: number; onPick: (value: number) => void; label?: string;
}) {
  const [depth, setDepth] = useState('1'), [upper, setUpper] = useState(false);
  const n = Number(depth), valid = depth !== '' && Number.isInteger(n) && n >= 0 && n <= 16;
  return <span className="halving-picker" role="group" aria-label={label}>
    <button type="button" title="Choose interval endpoint" onClick={() => setUpper(value => !value)}>{upper ? high : low} ↦</button>
    <input aria-label={`${label} depth`} title="Type halving depth; Enter applies" inputMode="numeric" value={depth} style={{width:36}}
      onChange={event => setDepth(event.target.value)} onFocus={event => event.currentTarget.select()}
      onKeyDown={event => { if (event.key === 'Enter' && valid) { event.preventDefault(); event.stopPropagation(); onPick(halvedValue(low, high, n, upper)); } }} />
    <button type="button" disabled={!valid} onClick={() => onPick(halvedValue(low, high, n, upper))}>½{valid ? `ⁿ → ${Number(halvedValue(low, high, n, upper).toPrecision(6))}` : ''}</button>
  </span>;
}
