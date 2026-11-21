import {useMemo,useRef,useLayoutEffect} from 'react';
import {AxisWheelDrawing} from '../composer/runtime/ui/AxisWheelDrawing.tsx';
import {createOriginControl,originControlRays,bindOriginAxisControl} from '../world/originAxisControl.ts';
import type {OriginDirections} from '../core/originDirections.ts';
export function OriginAxisView({active,directions,activate}:{active:readonly number[];directions:OriginDirections;activate:(target:{axis:number}|{key:string})=>void}){
 const host=useRef<HTMLDivElement>(null),action=useRef(activate);action.current=activate;
 const signature=JSON.stringify([active,directions]);
 const control=useMemo(()=>{const model=createOriginControl(active,directions);return {...model,rays:originControlRays(model.gizmo,model.camera,active,directions)};},[signature]);
 useLayoutEffect(()=>bindOriginAxisControl(host.current!,control,target=>action.current(target)),[control]);
 return <div className="origin-direction-axes axis-wheel-surface" role="group" aria-label="Origin axes" ref={host}><AxisWheelDrawing rays={control.rays}/></div>;
}
