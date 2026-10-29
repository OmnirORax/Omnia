import { radialScale } from './radialMenuState';
import { uiPointerHeld } from './pointerOwnership';
import { RangeControl, RangeAxis, RangeGestureTarget, type RangeGesture } from './RangeControl';
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type Ref, type CSSProperties } from 'react';
import type { RadialNode } from './radialMenuModel';
import { radialLayout, RADIAL_GEOMETRY, radialQuickSlot } from './radialMenuModel';
import { ContextualMasterController } from './ContextualMasterController';
import './radialMenu.css';
export type RadialNavigation={back:()=>boolean;open:()=>void};
type CategoryAnchor={id:string;x:number;y:number};
export function RadialMenu({items,inset,onClose,navigationRef,children,onNavigationChange,quickItems,quickEnd,heldOpen=false}: {
  items:RadialNode<ReactNode>[];inset?:ReactNode;onClose:()=>void;navigationRef?:Ref<RadialNavigation>;children?:ReactNode;onNavigationChange?:(nested:boolean)=>void;quickItems?:ReactNode[];quickEnd?:ReactNode[];heldOpen?:boolean;
}) {
  const sliderGestures=useRef(new Map<string,{current:RangeGesture|null}>()),adjustment=useRef<{id:string;pointer:number;api:RangeGesture}|null>(null),suppressAdjustmentClick=useRef(false);
  const [adjusting,setAdjusting]=useState<string|null>(null);
  const scale=useSyncExternalStore(radialScale.subscribe,radialScale.getSnapshot);
  const sizeControl=<span className="radial-menu-setter radial-menu-scale" title="Dial size · 1×–2×"><RangeControl aria-label="Dial size" configurationKey="ui.dial.scale" value={scale} min={1} max={2} step={.05} onValueChange={radialScale.set}/></span>;
  const root=useRef<HTMLDivElement>(null),[quickExtent,setQuickExtent]=useState(360);
  useLayoutEffect(()=>{
    const node=root.current;if(!node||!children&&!quickItems)return;
    const measure=()=>setQuickExtent(node.getBoundingClientRect().width);
    const observer=new ResizeObserver(measure);observer.observe(node);measure();
    return()=>observer.disconnect();
  },[!!quickItems,!!children]);
  const [path,setPath]=useState<CategoryAnchor[]>([]);
  const childAnchor=(owner:HTMLElement,slot:HTMLElement,childExtent:number):CategoryAnchor=>{
    const ownerBox=owner.getBoundingClientRect(),slotBox=slot.getBoundingClientRect();
    const ox=ownerBox.left+ownerBox.width/2,oy=ownerBox.top+ownerBox.height/2;
    const x=slotBox.left+slotBox.width/2,y=slotBox.top+slotBox.height/2,dx=x-ox,dy=y-oy,length=Math.hypot(dx,dy)||1;
    const distance=ownerBox.width/2+childExtent*scale/2+2;
    return {id:'',x:ox+dx/length*distance,y:oy+dy/length*distance};
  };
  const hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const keepChildren=()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);};
  const leaveChildren=()=>{keepChildren();hoverTimer.current=setTimeout(()=>{if(!uiPointerHeld())setPath([]);},120);};
  useEffect(()=>()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);},[]);
  useEffect(()=>{onNavigationChange?.(path.length>0);},[path.length,onNavigationChange]);
  const back=()=>{if(path.length){setPath(path.slice(0,-1));return true;}return false;};
  useImperativeHandle(navigationRef,()=>({back,open:()=>setPath([])}));
  const branches:{anchor:CategoryAnchor;node:RadialNode<ReactNode>}[]=[];
  let level=items;
  for(const anchor of path){const node=level.find(node=>node.id===anchor.id);if(!node?.children)break;branches.push({anchor,node});level=node.children;}
  const ring=(nodes:RadialNode<ReactNode>[],depth:number,embedded=false)=>{const layout=radialLayout(nodes,depth);return nodes.map((node,index)=>{
    const gestureKey=`${depth}:${node.id}`;let gestureTarget=sliderGestures.current.get(gestureKey);if(!gestureTarget){gestureTarget={current:null};sliderGestures.current.set(gestureKey,gestureTarget);}
    const quick=depth===0&&!!quickItems;
    const slot=quick?radialQuickSlot(index+quickItems.length,quickExtent):layout.slots[index];
    const turn=(index+(embedded ? .5 : 0))/nodes.length*Math.PI*2,s=Math.sin(turn),c=Math.cos(turn),edge=slot.size/2+2;
    return <span key={node.id} className="radial-menu-slot" data-adjusting={adjusting===gestureKey}
      onPointerDownCapture={event=>{suppressAdjustmentClick.current=false;if(event.button!==0||!gestureTarget.current||event.target instanceof Element&&event.target.closest('.radial-menu-setter'))return;
        const api=gestureTarget.current;if(!api.start(event.pointerId,event.clientX,event.clientY))return;
        event.preventDefault();event.stopPropagation();adjustment.current={id:gestureKey,pointer:event.pointerId,api};setAdjusting(gestureKey);event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event=>{const active=adjustment.current;if(active?.id!==gestureKey||active.pointer!==event.pointerId)return;event.stopPropagation();active.api.move(event.clientX,event.clientY);}}
      onPointerUp={event=>{const active=adjustment.current;if(active?.id!==gestureKey||active.pointer!==event.pointerId)return;event.stopPropagation();active.api.finish(event.clientX,event.clientY);adjustment.current=null;setAdjusting(null);suppressAdjustmentClick.current=true;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onLostPointerCapture={()=>{if(adjustment.current?.id===gestureKey){adjustment.current.api.cancel();adjustment.current=null;setAdjusting(null);}}}
      onPointerCancel={()=>{if(adjustment.current?.id===gestureKey){adjustment.current.api.cancel();adjustment.current=null;setAdjusting(null);}}}
      onClickCapture={event=>{if(suppressAdjustmentClick.current){suppressAdjustmentClick.current=false;event.preventDefault();event.stopPropagation();}}} style={{left:embedded&&!quick?`calc(${50+s*50}% - ${s*edge}px)`:`${slot.x}%`,top:embedded&&!quick?`calc(${50-c*50}% + ${c*edge}px)`:`${slot.y}%`,width:slot.size,height:slot.size}} onMouseEnter={event=>{keepChildren();if(node.children){const owner=event.currentTarget.closest<HTMLElement>('.radial-menu'),layout=radialLayout(node.children!,depth+1);
        if(owner){const anchor=childAnchor(owner,event.currentTarget,layout.extent);setPath([...path.slice(0,depth),{...anchor,id:node.id}]);}}}} onMouseLeave={leaveChildren}>
      {node.setter&&<span className="radial-menu-setter" style={{left:layout.slots[index].setterX,top:layout.slots[index].setterY,transform:`translate(-50%,-50%) rotate(${layout.slots[index].setterAngle}deg)`}}><RangeGestureTarget.Provider value={gestureTarget}><RangeAxis.Provider value={layout.slots[index].setterAngle}>{node.setter}</RangeAxis.Provider></RangeGestureTarget.Provider></span>}
      {node.children?<button type="button" data-ui-id={`radial:${node.id}`} aria-label={node.label} title={node.label} aria-haspopup="true" aria-expanded={path[depth]?.id===node.id} style={node.symbol.length>2?{fontSize:10}:undefined}
        onClick={event=>{
          if(path[depth]?.id===node.id){setPath(path.slice(0,depth));return;}
          const owner=event.currentTarget.closest<HTMLElement>('.radial-menu'),layout=radialLayout(node.children!,depth+1);
          if(!owner)return;const anchor=childAnchor(owner,event.currentTarget,layout.extent);
          setPath([...path.slice(0,depth),{...anchor,id:node.id}]);
        }}>{node.symbol}</button>:node.content}
    </span>;
  });};
  const {extent,radius,size}=radialLayout(items);
  const dialStyle=(extent:number,size:number):CSSProperties=>({width:extent,zoom:scale,'--radial-button-size':`${size}px`,'--radial-opacity':RADIAL_GEOMETRY.opacity} as CSSProperties);
  return <>
    <div ref={root} className={`radial-menu${children?' radial-menu-editor':''}`} role="group" aria-label="Radial tools" data-tools-open={path.length>0||heldOpen} data-child-open={path.length>0} data-context-menu-owner data-ui-search data-ui-name-ignore
      onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} style={children?undefined:dialStyle(extent,size)}>
      {children&&<div className="radial-menu-canvas">{children}</div>}
      <svg className="radial-menu-rims" viewBox={children?'0 0 160 160':`0 0 ${extent} ${extent}`} aria-hidden={children?undefined:true} tabIndex={children?0:undefined} aria-label={children?"Hover the circular rim or focus it to reveal tools":undefined}>
        {children&&<circle cx="80" cy="80" r={Math.max(0,80-(quickItems?26:34)/quickExtent*160)} vectorEffect="non-scaling-stroke"/>}
        <circle className={children?"radial-menu-axis":undefined} cx={children?80:extent/2} cy={children?80:extent/2} r={children?Math.max(0,80-(quickItems?14:18)/quickExtent*160):radius}/>
      </svg>
      {quickItems?.map((content,index)=>{
        const slot=radialQuickSlot(index,quickExtent);
        return <span className="radial-menu-slot" key={index} style={{left:`${slot.x}%`,top:`${slot.y}%`,width:slot.size,height:slot.size}}>{content}</span>;
      })}
      {ring(items,0,!!children)}
      {quickItems&&quickEnd?.map((content,index)=>{
        const slot=radialQuickSlot(quickItems.length+items.length+index,quickExtent);
        return <span className="radial-menu-slot" key={`end:${index}`} style={{left:`${slot.x}%`,top:`${slot.y}%`,width:slot.size,height:slot.size}}>{content}</span>;
      })}
      {!quickItems&&inset&&<div className="radial-menu-insets">{inset}</div>}
      {!children&&<><span className="radial-menu-centre radial-menu-origin" role="button" tabIndex={0} data-dial-drag title="Drag dial" aria-label="Drag dial"/>{sizeControl}</>}
    </div>
    {branches.map(({anchor,node},index)=>{
      const depth=index+1,{extent,radius,size}=radialLayout(node.children!,depth);
      return <ContextualMasterController key={`${index}:${node.id}`} radial title={node.label} position={anchor} onDismiss={()=>{setPath([]);onClose();}} onClose={()=>setPath(path.slice(0,index))}>
        <div className="radial-menu radial-menu-branch" onMouseEnter={keepChildren} onMouseLeave={leaveChildren} role="group" aria-label={node.label} data-context-menu-owner data-child-level={depth} style={dialStyle(extent,size)}
          onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}>
          <svg className="radial-menu-rims" viewBox={`0 0 ${extent} ${extent}`} aria-hidden="true"><circle cx={extent/2} cy={extent/2} r={radius}/></svg>
          {ring(node.children!,depth)}
          {children&&index===0&&sizeControl}
          <div className="radial-menu-centre"><button type="button" data-dial-drag aria-label={`Back from ${node.label}`} style={node.symbol.length>2?{fontSize:10}:undefined} title={`${node.label} · Back`}
            onClick={()=>setPath(path.slice(0,index))} onContextMenu={event=>{event.preventDefault();event.stopPropagation();setPath(path.slice(0,index));}}>{node.symbol}</button></div>
        </div>
      </ContextualMasterController>;
    })}
  </>;
}
