import type {DialNotation} from '../../../properties/dialNotation.ts';
import {dialDrawingGeometry,dialDrawingMarks} from './dialDrawingGeometry.ts';
/** Shared paint only: miniatures never synthesize ticks from a decimal value. */
export function DialDrawing({notation,geometry=dialDrawingGeometry(notation.base,notation.marks.selected)}:{notation:DialNotation;geometry?:ReturnType<typeof dialDrawingGeometry>}){
 const {extent,size,rings,orders}=geometry,c=extent/2;
 return <svg className="mathematical-dial-drawing" viewBox={`0 0 ${extent} ${extent}`} aria-hidden="true">
  {rings.slice(0,orders).map(ring=><g key={ring.order}><circle cx={c} cy={c} r={ring.radius+size/2+1} fill="none" stroke="currentColor"/><text x={c} y={c-ring.radius-size/2} textAnchor="middle" fontSize="11" fill="currentColor">{notation.clockwise?'↻':'↶'}</text></g>)}
  <g className="mathematical-dial-ink"><circle cx={c} cy={c} r={notation.base*size/2} fill="none" stroke="currentColor"/>
  {Array.from({length:notation.base},(_,i)=><circle key={i} cx={c+(i-(notation.base-1)/2)*size} cy={c} r={size/2} fill="currentColor"/>)}
  {dialDrawingMarks(notation,geometry).map(mark=><g key={mark.key}><circle cx={c+mark.x} cy={c+mark.y} r={size/2} fill={mark.mode==='recursion'?'none':'currentColor'} stroke="currentColor"/>{mark.mode==='recursion'&&<><circle cx={c+mark.x} cy={c+mark.y} r={size*.4} fill="none" stroke="currentColor"/><circle cx={c+mark.x} cy={c+mark.y} r={size*.2} fill="none" stroke="currentColor"/></>}</g>)}
  </g>
 </svg>;
}
