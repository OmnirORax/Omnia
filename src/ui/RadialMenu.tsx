import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { RadialNode } from './radialMenuModel';
import { radialSlot, radialDimensions, radialQuickSlot } from './radialMenuModel';
import { ContextualMasterController } from './ContextualMasterController';
import './radialMenu.css';
export type RadialNavigation={back:()=>boolean;open:()=>void;toggle:()=>void};
type CategoryAnchor={id:string;x:number;y:number};
export function RadialMenu({items,inset,onClose,navigationRef,children,onNavigationChange,quickItems}: {
  items:RadialNode<ReactNode>[];inset?:ReactNode;onClose:()=>void;navigationRef?:Ref<RadialNavigation>;children?:ReactNode;onNavigationChange?:(nested:boolean)=>void;quickItems?:ReactNode[];
}) {
  const root=useRef<HTMLDivElement>(null),[quickExtent,setQuickExtent]=useState(360);
  useLayoutEffect(()=>{
    const node=root.current;if(!node||!quickItems)return;
    const measure=()=>setQuickExtent(node.getBoundingClientRect().width);
    const observer=new ResizeObserver(measure);observer.observe(node);measure();
    return()=>observer.disconnect();
  },[!!quickItems]);
  const [path,setPath]=useState<CategoryAnchor[]>([]),[visible,setVisible]=useState(true);
  useEffect(()=>{onNavigationChange?.(path.length>0||!visible);},[path.length,visible,onNavigationChange]);
  const back=()=>{if(!visible){setVisible(true);return true;}if(path.length){setPath(path.slice(0,-1));return true;}return false;};
  useImperativeHandle(navigationRef,()=>({back,open:()=>{setVisible(true);setPath([]);},toggle:()=>setVisible(!visible)}));
  const branches:{anchor:CategoryAnchor;node:RadialNode<ReactNode>}[]=[];
  let level=items;
  for(const anchor of path){const node=level.find(node=>node.id===anchor.id);if(!node?.children)break;branches.push({anchor,node});level=node.children;}
  const ring=(nodes:RadialNode<ReactNode>[],depth:number,embedded=false)=>nodes.map((node,index)=>{
    const quick=depth===0&&!!quickItems;
    const slot=quick?radialQuickSlot(index+quickItems.length,quickExtent):radialSlot(index,nodes.length,depth);
    const turn=(index+(embedded ? .5 : 0))/nodes.length*Math.PI*2,s=Math.sin(turn),c=Math.cos(turn),edge=slot.size/2+2;
    return <span key={node.id} className="radial-menu-slot" style={{left:embedded&&!quick?`calc(${50+s*50}% - ${s*edge}px)`:`${slot.x}%`,top:embedded&&!quick?`calc(${50-c*50}% + ${c*edge}px)`:`${slot.y}%`,width:slot.size,height:slot.size}}>
      {node.children?<button type="button" data-ui-id={`radial:${node.id}`} aria-label={node.label} title={node.label} aria-haspopup="true" aria-expanded={path[depth]?.id===node.id}
        onClick={event=>{
          if(path[depth]?.id===node.id){setPath(path.slice(0,depth));return;}
          // Measure only the clicked category, never on hover or pointer movement.
          const bounds=event.currentTarget.getBoundingClientRect();
          setPath([...path.slice(0,depth),{id:node.id,x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2}]);
        }}>{node.symbol}</button>:node.content}
    </span>;
  });
  const {extent,radius}=radialDimensions(0,items.length);
  return <>
    <div ref={root} className={`radial-menu${children?' radial-menu-editor':''}`} role="group" aria-label="Radial tools" data-context-menu-owner data-ui-search data-ui-name-ignore
      onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} style={children?undefined:{width:`min(${extent}px,calc(100vw - 16px),calc(100vh - 16px))`}}>
      {children&&<div className="radial-menu-canvas">{children}</div>}
      <svg className="radial-menu-rims" viewBox={children?'0 0 160 160':`0 0 ${extent} ${extent}`} aria-hidden="true">
        <circle cx={children?80:extent/2} cy={children?80:extent/2} r={children?64:radius}/>
      </svg>
      {visible&&quickItems?.map((content,index)=>{
        const slot=radialQuickSlot(index,quickExtent);
        return <span className="radial-menu-slot" key={index} style={{left:`${slot.x}%`,top:`${slot.y}%`,width:slot.size,height:slot.size}}>{content}</span>;
      })}
      {visible&&ring(items,0,!!children)}
      {visible&&!quickItems&&inset&&<div className="radial-menu-insets">{inset}</div>}
      <div className="radial-menu-centre">
        <button type="button" aria-label={visible?'Hide tools':'Show tools'} title={`${visible?'Hide tools':'Show tools'} · Right-click ${path.length?'Back':'Close'} · Esc steps outward`} aria-pressed={visible} style={{opacity:visible?1:.5}}
          onClick={()=>setVisible(!visible)} onContextMenu={event=>{event.preventDefault();event.stopPropagation();if(!back())onClose();}}>👁</button>
      </div>
    </div>
    {visible&&branches.map(({anchor,node},index)=>{
      const depth=index+1,{extent,radius}=radialDimensions(depth,node.children!.length);
      return <ContextualMasterController key={`${index}:${node.id}`} radial title={node.label} position={anchor} onClose={()=>setPath(path.slice(0,index))}>
        <div className="radial-menu radial-menu-branch" role="group" aria-label={node.label} data-context-menu-owner style={{width:`min(${extent}px,calc(100vw - 16px),calc(100vh - 16px))`}}
          onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}>
          <svg className="radial-menu-rims" viewBox={`0 0 ${extent} ${extent}`} aria-hidden="true"><circle cx={extent/2} cy={extent/2} r={radius}/></svg>
          {ring(node.children!,depth)}
          <div className="radial-menu-centre"><button type="button" aria-label={`Back from ${node.label}`} title={`${node.label} · Back`}
            onClick={()=>setPath(path.slice(0,index))} onContextMenu={event=>{event.preventDefault();event.stopPropagation();setPath(path.slice(0,index));}}>{node.symbol}</button></div>
        </div>
      </ContextualMasterController>;
    })}
  </>;
}
