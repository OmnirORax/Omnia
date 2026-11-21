import type {ReactNode} from 'react';
import {AXIS_DIAL,dialPoint,dialSegments,dialTickWidth,type AxisDialRay} from '../../../properties/axisDial.ts';
import './axisWheelDrawing.css';
export type AxisWheelRay=AxisDialRay;
/** One visual for axis selectors and rotation fields; consumers retain value ownership. */
export function AxisWheelDrawing({rays,children,selectionDisplay='needle',hub=false}:{rays:readonly AxisWheelRay[];children?:ReactNode;selectionDisplay?:'needle'|'ticks';hub?:boolean}){
 const directions=rays.filter(ray=>ray.kind!=='axis'),tickWidth=dialTickWidth(directions.length),singleSelection=directions.filter(ray=>ray.selected).length===1;
 return <svg className="radial-menu-rims axis-wheel-drawing" viewBox="-1 -1 2 2" aria-hidden="true"><circle className="axis-wheel-rim" r={AXIS_DIAL.rim}/>{hub&&<circle className="axis-wheel-hub" r={AXIS_DIAL.hub}/>}{rays.map(ray=>{const axis=ray.kind==='axis',needle=!axis&&selectionDisplay==='needle'&&(ray.preview||ray.selected&&singleSelection),a=dialPoint(ray.point,AXIS_DIAL.axisInner),b=dialPoint(ray.point,AXIS_DIAL.needleOuter);return <g key={ray.id} style={ray.color?{color:ray.color}:undefined} data-selected={ray.selected} data-preview={ray.preview}>
  {dialSegments({...ray,threshold:ray.threshold||ray.preview}).map(({a,b},i)=><line key={i} className={axis?'axis-wheel-arm':'axis-wheel-tick'} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={axis?undefined:{strokeWidth:tickWidth}} vectorEffect={axis?'non-scaling-stroke':undefined}/>)}
  {needle&&<line className="axis-wheel-needle" x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke"/>}
 </g>;})}{children}</svg>;
}
