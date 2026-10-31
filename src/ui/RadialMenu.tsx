import {useContextNavigation} from './ContextStage';
import { radialScale } from './radialMenuState';
import { uiPointerHeld,observeUIPress } from './pointerOwnership';
import { RangeControl, RangeAxis, RangeGestureTarget, type RangeGesture } from './RangeControl';
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type Ref, type CSSProperties } from 'react';
import type { RadialNode } from './radialMenuModel';
import { radialLayout, radialRowLayout, radialRowAttachment, RADIAL_GEOMETRY, radialQuickSlot } from './radialMenuModel';
import { ContextualMasterController } from './ContextualMasterController';
import './radialMenu.css';
export type RadialNavigation={back:()=>boolean;forward:()=>boolean;open:()=>void};
type CategoryAnchor={id:string;x:number;y:number;axis:{x:number;y:number}};
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
  const [automatic,setAutomatic]=useState<CategoryAnchor[]>([]);
  const categorySlots=useRef(new Map<string,HTMLElement>());
  const [path,setPath]=useState<CategoryAnchor[]>([]),outward=useRef<CategoryAnchor[]|null>(null);
  const childAnchor=(owner:HTMLElement,slot:HTMLElement,childLength:number):CategoryAnchor=>{
    const ownerBox=owner.getBoundingClientRect(),slotBox=slot.getBoundingClientRect();
    const ox=ownerBox.left+ownerBox.width/2,oy=ownerBox.top+ownerBox.height/2;
    const button={x:slotBox.left+slotBox.width/2,y:slotBox.top+slotBox.height/2,width:slotBox.width};
    const row=owner.dataset.rowX!==undefined?{axis:{x:Number(owner.dataset.rowX),y:Number(owner.dataset.rowY)},length:Number(owner.dataset.rowLength)}:undefined;
    return {id:'',...radialRowAttachment({x:ox,y:oy},button,childLength,scale,row)};
  };
  // Standalone category dials reveal their immediate children on mount. Measure
  // after popup placement, and on resize/release, never on pointer movement.
  useLayoutEffect(()=>{
    if(children){setAutomatic(before=>before.length?[]:before);return;}
    let frame=0;
    const measure=()=>{const owner=root.current;if(!owner)return;
      const next=items.flatMap(node=>{const slot=categorySlots.current.get(node.id);if(!node.children||!slot)return [];
        return [{...childAnchor(owner,slot,radialRowLayout(node.children,{x:0,y:-1}).length),id:node.id}];});
      setAutomatic(before=>JSON.stringify(before)===JSON.stringify(next)?before:next);
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);if(root.current)observer.observe(root.current);
    const stop=observeUIPress(active=>{if(!active)schedule();});
    window.addEventListener('resize',schedule);schedule();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();stop();window.removeEventListener('resize',schedule);};
  },[items,scale,!!children]);
  const hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const keepChildren=()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);};
  const leaveChildren=()=>{keepChildren();hoverTimer.current=setTimeout(()=>{if(!uiPointerHeld())setPath([]);},120);};
  useEffect(()=>()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);},[]);
  useEffect(()=>{onNavigationChange?.(path.length>0);},[path.length,onNavigationChange]);
  const back=()=>{if(path.length){outward.current=path;setPath(path.slice(0,-1));return true;}return false;};
  const forward=()=>{if(outward.current&&outward.current.length>path.length){setPath(outward.current);outward.current=null;return true;}return false;};
  useContextNavigation({owner:root,back:path.length?()=>{back();}:undefined,advance:()=>{forward();}});
  useImperativeHandle(navigationRef,()=>({back,forward,open:()=>setPath([])}));
  const branches:{anchor:CategoryAnchor;node:RadialNode<ReactNode>;lineage:CategoryAnchor[];automatic?:boolean}[]=automatic.flatMap(anchor=>{const node=items.find(n=>n.id===anchor.id);return node?.children?[{anchor,node,lineage:[anchor],automatic:true}]:[];});
  let level=items;
  for(const anchor of path){const node=level.find(node=>node.id===anchor.id);if(!node?.children)break;if(!automatic.some(a=>a.id===anchor.id))branches.push({anchor,node,lineage:path.slice(0,path.indexOf(anchor)+1)});level=node.children;}
  const ring=(nodes:RadialNode<ReactNode>[],depth:number,embedded=false,axis?:{x:number;y:number},lineage:CategoryAnchor[]=[])=>{const layout=axis?radialRowLayout(nodes,axis):radialLayout(nodes,depth);return nodes.map((node,index)=>{
    const gestureKey=`${depth}:${node.id}`;let gestureTarget=sliderGestures.current.get(gestureKey);if(!gestureTarget){gestureTarget={current:null};sliderGestures.current.set(gestureKey,gestureTarget);}
    const quick=depth===0&&!!quickItems;
    const slot=quick?radialQuickSlot(index+quickItems.length,quickExtent):layout.slots[index];
    const turn=(index+(embedded ? .5 : 0))/nodes.length*Math.PI*2,s=Math.sin(turn),c=Math.cos(turn),edge=slot.size/2+2;
    return <span key={node.id} ref={element=>{if(depth!==0)return;if(element)categorySlots.current.set(node.id,element);else categorySlots.current.delete(node.id);}} className="radial-menu-slot" data-adjusting={adjusting===gestureKey}
      onPointerDownCapture={event=>{suppressAdjustmentClick.current=false;if(event.button!==0||!gestureTarget.current||event.target instanceof Element&&event.target.closest('.radial-menu-setter'))return;
        const api=gestureTarget.current;if(!api.start(event.pointerId,event.clientX,event.clientY))return;
        event.preventDefault();event.stopPropagation();adjustment.current={id:gestureKey,pointer:event.pointerId,api};setAdjusting(gestureKey);event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event=>{const active=adjustment.current;if(active?.id!==gestureKey||active.pointer!==event.pointerId)return;event.stopPropagation();active.api.move(event.clientX,event.clientY);}}
      onPointerUp={event=>{const active=adjustment.current;if(active?.id!==gestureKey||active.pointer!==event.pointerId)return;event.stopPropagation();active.api.finish(event.clientX,event.clientY);adjustment.current=null;setAdjusting(null);suppressAdjustmentClick.current=true;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onLostPointerCapture={()=>{if(adjustment.current?.id===gestureKey){adjustment.current.api.cancel();adjustment.current=null;setAdjusting(null);}}}
      onPointerCancel={()=>{if(adjustment.current?.id===gestureKey){adjustment.current.api.cancel();adjustment.current=null;setAdjusting(null);}}}
      onClickCapture={event=>{if(suppressAdjustmentClick.current){suppressAdjustmentClick.current=false;event.preventDefault();event.stopPropagation();}}} style={{left:embedded&&!quick?`calc(${50+s*50}% - ${s*edge}px)`:`${slot.x}%`,top:embedded&&!quick?`calc(${50-c*50}% + ${c*edge}px)`:`${slot.y}%`,width:slot.size,height:slot.size}} onMouseEnter={event=>{keepChildren();if(node.children){const owner=event.currentTarget.closest<HTMLElement>('.radial-menu'),layout=radialRowLayout(node.children!,{x:0,y:-1});
        if(owner){const anchor=childAnchor(owner,event.currentTarget,layout.length);setPath([...lineage,{...anchor,id:node.id}]);}}}} onMouseLeave={event=>{const branch=event.currentTarget.closest('.radial-menu-branch');if(event.relatedTarget instanceof Node&&branch?.contains(event.relatedTarget))keepChildren();else leaveChildren();}}>
      {node.setter&&<span className="radial-menu-setter" style={{left:layout.slots[index].setterX,top:layout.slots[index].setterY,transform:`translate(-50%,-50%) rotate(${layout.slots[index].setterAngle}deg)`}}><RangeGestureTarget.Provider value={gestureTarget}><RangeAxis.Provider value={layout.slots[index].setterAngle}>{node.setter}</RangeAxis.Provider></RangeGestureTarget.Provider></span>}
      {node.children?<button type="button" data-ui-id={`radial:${node.id}`} aria-label={node.label} title={node.label} aria-haspopup="true" aria-expanded={depth===0&&automatic.some(a=>a.id===node.id)||path[depth]?.id===node.id} style={node.symbol.length>2?{fontSize:10}:undefined}
        onClick={event=>{
          if(path[depth]?.id===node.id){if(depth!==0||!automatic.length)setPath(lineage);return;}
          const owner=event.currentTarget.closest<HTMLElement>('.radial-menu'),layout=radialRowLayout(node.children!,{x:0,y:-1});
          if(!owner)return;const anchor=childAnchor(owner,event.currentTarget,layout.length);
          setPath([...lineage,{...anchor,id:node.id}]);
        }}>{node.symbolMask?<span aria-hidden="true" style={{width:'1.3em',height:'1.3em',background:'currentColor',maskImage:`url("${node.symbolMask}")`,WebkitMaskImage:`url("${node.symbolMask}")`,maskSize:'contain',maskRepeat:'no-repeat'}}/>:node.symbol}</button>:node.content}
    </span>;
  });};
  const {extent,radius,size}=radialLayout(items);
  const dialStyle=(extent:number,size:number):CSSProperties=>({width:extent,zoom:scale,'--radial-button-size':`${size}px`,'--radial-opacity':RADIAL_GEOMETRY.opacity} as CSSProperties);
  return <>
    <div ref={root} data-radial-extent={children?undefined:extent} data-radial-outer={children?undefined:radius+size/2} className={`radial-menu${children?' radial-menu-editor':''}`} role="group" aria-label="Radial tools" data-tools-open={path.length>0||heldOpen} data-child-open={path.length>0} data-context-menu-owner data-ui-search data-ui-name-ignore
      onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} style={children?undefined:dialStyle(extent,size)}>
      {children&&<div className="radial-menu-canvas">{children}</div>}
      <svg className="radial-menu-rims" viewBox={children?'0 0 160 160':`0 0 ${extent} ${extent}`} aria-hidden={children?undefined:true} tabIndex={children?0:undefined} aria-label={children?"Hover the circular rim or focus it to reveal tools":undefined}>
        {children&&<circle cx="80" cy="80" r={Math.max(0,80-(quickItems?26:34)/quickExtent*160)} vectorEffect="non-scaling-stroke"/>}
        <circle fill="none" className={children?"radial-menu-axis":undefined} cx={children?80:extent/2} cy={children?80:extent/2} r={children?Math.max(0,80-(quickItems?14:18)/quickExtent*160):radius}/>
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
    {branches.map(({anchor,node,lineage,automatic:isAutomatic},index)=>{
      const depth=lineage.length,{extent,size,length,angle}=radialRowLayout(node.children!,anchor.axis);
      return <ContextualMasterController key={lineage.map(a=>a.id).join("/")} radial anchored title={node.label} position={anchor} onDismiss={()=>{setPath([]);onClose();}} onAdvance={forward} onClose={()=>{if(isAutomatic){onClose();return;}outward.current=path;setPath(lineage.slice(0,-1));}}>
        <div className="radial-menu radial-menu-branch radial-menu-row" onMouseEnter={keepChildren} onMouseLeave={leaveChildren} role="group" aria-label={node.label} data-context-menu-owner data-child-level={depth} data-radial-extent={extent} data-row-x={anchor.axis.x} data-row-y={anchor.axis.y} data-row-length={length} style={dialStyle(extent,size)}
          onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}>
          <span className="radial-menu-row-zone" aria-hidden="true" style={{width:length+4,height:size+4,transform:`translate(-50%,-50%) rotate(${angle}deg)`}}/>
          {ring(node.children!,depth,false,anchor.axis,lineage)}
          {children&&index===0&&<span style={{position:'absolute',left:`calc(50% + ${anchor.axis.y*(size/2+10)}px)`,top:`calc(50% - ${anchor.axis.x*(size/2+10)}px)`}}>{sizeControl}</span>}
        </div>
      </ContextualMasterController>;
    })}
  </>;
}
