import { useEffect, useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import type { RadialNode } from './radialMenuModel';
import { radialSlot, radialDimensions } from './radialMenuModel';
import './radialMenu.css';
export type RadialNavigation={back:()=>boolean;open:()=>void;toggle:()=>void};
export function RadialMenu({items,inset,onClose,navigationRef,children,onNavigationChange}: {
  items:RadialNode<ReactNode>[];inset?:ReactNode;onClose:()=>void;navigationRef?:Ref<RadialNavigation>;children?:ReactNode;onNavigationChange?:(nested:boolean)=>void;
}) {
  const [path,setPath]=useState<string[]>([]),[visible,setVisible]=useState(true);
  useEffect(()=>{onNavigationChange?.(path.length>0||!visible);},[path.length,visible,onNavigationChange]);
  const back=()=>{if(!visible){setVisible(true);return true;}if(path.length){setPath(path.slice(0,-1));return true;}return false;};
  useImperativeHandle(navigationRef,()=>({back,open:()=>{setVisible(true);setPath([]);},toggle:()=>setVisible(!visible)}));
  const levels=[items];
  for(const id of path){const next=levels.at(-1)!.find(node=>node.id===id)?.children;if(!next)break;levels.push(next);}
  const depth=levels.length-1,{extent,radius}=radialDimensions(depth,levels.at(-1)!.length);
  return <div className={`radial-menu${children?' radial-menu-editor':''}`} role="group" aria-label="Radial tools" data-context-menu-owner data-ui-search data-ui-name-ignore
    onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} style={children?undefined:{width:`min(${extent}px,calc(100vw - 16px),calc(100vh - 16px))`}}>
    {children&&<div className="radial-menu-canvas">{children}</div>}
    <svg className="radial-menu-rims" viewBox={children?'0 0 160 160':`0 0 ${extent} ${extent}`} aria-hidden="true">
      <circle cx={children?80:extent/2} cy={children?80:extent/2} r={children?64:radius}/>
    </svg>
    {visible&&levels.at(-1)!.map((node,index)=>{
      const slot=radialSlot(index,levels.at(-1)!.length,depth);
      const turn=(index+(children ? .5 : 0))/levels.at(-1)!.length*Math.PI*2,s=Math.sin(turn),c=Math.cos(turn),edge=slot.size/2+2;
      return <span key={`${depth}:${node.id}`} className="radial-menu-slot" style={{left:children?`calc(${50+s*50}% - ${s*edge}px)`:`${slot.x}%`,top:children?`calc(${50-c*50}% + ${c*edge}px)`:`${slot.y}%`,width:slot.size,height:slot.size}}>
        {node.children?<button type="button" data-ui-id={`radial:${node.id}`} aria-label={node.label} title={node.label} aria-haspopup="true"
          onClick={()=>setPath([...path.slice(0,depth),node.id])}>{node.symbol}</button>:node.content}
      </span>;
    })}
    {visible&&depth===0&&inset&&<div className="radial-menu-insets">{inset}</div>}
    <div className="radial-menu-centre">
      <button type="button" aria-label={visible?'Hide tools':'Show tools'} title={`${visible?'Hide tools':'Show tools'} · Right-click ${path.length?'Back':'Close'} · Esc steps outward`} aria-pressed={visible} style={{opacity:visible?1:.5}}
        onClick={()=>setVisible(!visible)} onContextMenu={event=>{event.preventDefault();event.stopPropagation();if(!back())onClose();}}>👁</button>
    </div>
  </div>;
}
