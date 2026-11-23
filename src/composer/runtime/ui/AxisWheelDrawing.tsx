import type {ReactNode} from 'react';
import {AXIS_DIAL,dialAreaPath,dialPoint,dialSegments,dialTickWidth,type AxisDialRay} from '../../../properties/axisDial.ts';
import './axisWheelDrawing.css';
export type AxisWheelRay=AxisDialRay;
/** One visual for axis selectors and rotation fields; consumers retain value ownership. */
export function AxisWheelDrawing({rays,children,selectionDisplay='needle',hub=false,areas=[],hubColor}:{rays:readonly AxisWheelRay[];children?:ReactNode;selectionDisplay?:'needle'|'ticks';hub?:boolean;areas?:readonly boolean[];hubColor?:string}){
 const directions=rays.filter(ray=>ray.kind!=='axis'),tickWidth=dialTickWidth(directions.length),singleSelection=directions.filter(ray=>ray.selected).length===1;
 return <svg className="radial-menu-rims axis-wheel-drawing" viewBox="-1 -1 2 2" aria-hidden="true">{areas.map((enabled,index)=>enabled&&<path key={`area:${index}`} className="axis-wheel-area" d={dialAreaPath(index,areas.length)}/>)}<circle className="axis-wheel-rim" r={AXIS_DIAL.rim}/>{hub&&<g style={hubColor?{color:hubColor}:undefined}><circle className="axis-wheel-hub" r={AXIS_DIAL.hub}/>{hubColor&&<circle className="axis-wheel-facing" r=".022"/>}</g>}{rays.map(ray=>{const axis=ray.kind==='axis',needle=!axis&&selectionDisplay==='needle'&&(ray.preview||ray.selected&&singleSelection),a=dialPoint(ray.point,AXIS_DIAL.axisInner),b=dialPoint(ray.point,AXIS_DIAL.needleOuter);return <g key={ray.id} style={ray.color?{color:ray.color}:undefined} data-selected={ray.selected} data-preview={ray.preview}>
  {dialSegments({...ray,threshold:ray.threshold||ray.preview}).map(({a,b},i)=><line key={i} className={axis?'axis-wheel-arm':'axis-wheel-tick'} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={axis?undefined:{strokeWidth:tickWidth}} vectorEffect={axis?'non-scaling-stroke':undefined}/>)}
  {ray.label&&<text className="axis-wheel-label" x={dialPoint(ray.point,.64).x} y={dialPoint(ray.point,.64).y} textAnchor="middle" dominantBaseline="central">{ray.label}</text>}
  {needle&&<line className="axis-wheel-needle" x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke"/>}
 </g>;})}{children}</svg>;
}
