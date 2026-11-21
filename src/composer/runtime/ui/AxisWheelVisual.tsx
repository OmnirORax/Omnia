import type {ReactNode} from 'react';
import './axisWheelVisual.css';
export type AxisWheelRay={id:string;point:{x:number;y:number};selected:boolean;preview?:boolean;threshold?:boolean;color?:string;arrow?:boolean;label?:string;onToggle?:()=>void};
/** Canonical axis-wheel drawing; consumers retain their own activation/value owners. */
export function AxisWheelVisual({rays,children,rim=true}:{rays:readonly AxisWheelRay[];children?:ReactNode;rim?:boolean}){
 return <svg className="radial-menu-rims axis-wheel-visual" viewBox="-1 -1 2 2" aria-hidden={rays.some(ray=>ray.onToggle)?undefined:true}>{rim&&<circle r=".8"/>}{rays.map(ray=>{const p=ray.point,length=Math.hypot(p.x,p.y),ux=length?p.x/length:0,uy=length?p.y/length:0;return <g key={ray.id} style={ray.color?{color:ray.color}:undefined} role={ray.onToggle?'button':undefined} tabIndex={ray.onToggle?0:undefined} aria-label={ray.label} aria-pressed={ray.onToggle?ray.selected:undefined} onClick={ray.onToggle} onKeyDown={ray.onToggle?event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();ray.onToggle?.();}}:undefined}>
  <line className={`axis-wheel-arm ${ray.threshold?'dof-axis-threshold':''}`} data-selected={ray.selected} data-preview={ray.preview} x1="0" y1="0" x2={p.x} y2={p.y} vectorEffect="non-scaling-stroke"/>
  {ray.arrow&&<path className="axis-wheel-arrow" data-selected={ray.selected} d={`M${p.x-.09*ux+.045*uy} ${p.y-.09*uy-.045*ux}L${p.x} ${p.y}L${p.x-.09*ux-.045*uy} ${p.y-.09*uy+.045*ux}`} vectorEffect="non-scaling-stroke"/>}
  {ray.onToggle&&<line className="axis-wheel-hit" x1="0" y1="0" x2={p.x} y2={p.y} vectorEffect="non-scaling-stroke"/>}
 </g>;})}{children}</svg>;
}
