import type {ReactNode} from 'react';
import './axisWheelDrawing.css';
export type AxisWheelRay={id:string;point:{x:number;y:number};start?:{x:number;y:number};selected:boolean;preview?:boolean;threshold?:boolean;color?:string};
/** Shared composer-wheel paint only; each consumer retains its own interaction. */
export function AxisWheelDrawing({rays,children}:{rays:readonly AxisWheelRay[];children?:ReactNode}){
 return <svg className="radial-menu-rims axis-wheel-drawing" viewBox="-1 -1 2 2" aria-hidden="true"><circle r=".8"/>{rays.map(ray=><line key={ray.id} className={`axis-wheel-ray ${ray.threshold?'dof-axis-threshold':''}`} style={ray.color?{color:ray.color}:undefined} data-selected={ray.selected} data-preview={ray.preview} x1={ray.start?.x??0} y1={ray.start?.y??0} x2={ray.point.x} y2={ray.point.y} vectorEffect="non-scaling-stroke"/>)}{children}</svg>;
}
