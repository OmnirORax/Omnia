import { useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import type { RadialNode } from './radialMenuModel';
import { radialSlot, radialDimensions } from './radialMenuModel';
import './radialMenu.css';
export type RadialNavigation={back:()=>boolean};
export function RadialMenu({items,inset,onClose,navigationRef}: {
  items:RadialNode<ReactNode>[];inset?:ReactNode;onClose:()=>void;navigationRef?:Ref<RadialNavigation>;
}) {
  const [path,setPath]=useState<string[]>([]),[visible,setVisible]=useState(true);
  const back=()=>{if(!visible){setVisible(true);return true;}if(path.length){setPath(path.slice(0,-1));return true;}return false;};
  useImperativeHandle(navigationRef,()=>({back}));
  const levels=[items];
  for(const id of path){const next=levels.at(-1)!.find(node=>node.id===id)?.children;if(!next)break;levels.push(next);}
  const depth=levels.length-1,{extent,radius}=radialDimensions(depth);
  return <div className="radial-menu" role="group" aria-label="Radial tools" style={{width:`min(${extent}px,calc(100vw - 16px),calc(100vh - 16px))`}}>
    <svg className="radial-menu-rims" viewBox={`0 0 ${extent} ${extent}`} aria-hidden="true">
      <circle cx={extent/2} cy={extent/2} r={radius}/>
    </svg>
    {visible&&levels.at(-1)!.map((node,index)=>{
      const slot=radialSlot(index,levels.at(-1)!.length,depth);
      return <span key={`${depth}:${node.id}`} className="radial-menu-slot" style={{left:`${slot.x}%`,top:`${slot.y}%`,width:slot.size,height:slot.size}}>
        {node.children?<button type="button" data-ui-id={`radial:${node.id}`} aria-label={node.label} title={node.label} aria-haspopup="true"
          onClick={()=>setPath([...path.slice(0,depth),node.id])}>{node.symbol}</button>:node.content}
      </span>;
    })}
    {visible&&depth===0&&inset&&<div className="radial-menu-insets">{inset}</div>}
    <div className="radial-menu-centre">
      <button type="button" aria-label={visible?'Hide tools':'Show tools'} title={`${visible?'Hide tools':'Show tools'} · Right-click ${path.length?'Back':'Close'} · Esc steps outward`} aria-pressed={visible}
        onClick={()=>setVisible(!visible)} onContextMenu={event=>{event.preventDefault();event.stopPropagation();if(!back())onClose();}}>⠿</button>
    </div>
  </div>;
}
