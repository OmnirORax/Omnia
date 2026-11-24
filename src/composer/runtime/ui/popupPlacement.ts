export type PopupRect={x:number;y:number;width:number;height:number};
/** A radial stage replaces the previous menu at the invocation point. Only
 * rectangular editors use button-below/parent-separation placement. */
export function controllerCenter(requested:{x:number;y:number},child:{width:number;height:number},parents:readonly PopupRect[],button:PopupRect|null,radial:boolean,anchored:boolean){
 if(radial||anchored)return requested;
 return button?popupBelowButton(button,child,parents):placePopup(parents,child,requested);
}
/** Keep the invocation point unless the child would cover its logical parent.
 * On overlap, separate along the invocation's outward axis by the minimum
 * rectangle separation. This also works for wide value strips and compact dials. */
export function separatePopup(parent:PopupRect,child:{width:number;height:number},requested:{x:number;y:number},gap=4){
 const center={x:parent.x+parent.width/2,y:parent.y+parent.height/2};
 let dx=requested.x-center.x,dy=requested.y-center.y;
 const halfX=(parent.width+child.width)/2+gap,halfY=(parent.height+child.height)/2+gap;
 if(Math.abs(dx)>=halfX||Math.abs(dy)>=halfY)return requested;
 if(Math.hypot(dx,dy)<1){dx=0;dy=1;}
 const distance=Math.min(Math.abs(dx)>0?halfX/Math.abs(dx):Infinity,Math.abs(dy)>0?halfY/Math.abs(dy):Infinity);
 return {x:center.x+dx*distance,y:center.y+dy*distance};
}

/** Ancestors remain visible too, even when an inner-side invocation points back
 * toward an older popup. Only bounded opening/resize work uses this search. */
export function placePopup(parents:readonly PopupRect[],child:{width:number;height:number},requested:{x:number;y:number},gap=4){
 if(!parents.length)return requested;
 const preferred=separatePopup(parents[0],child,requested,gap);
 const clear=(point:{x:number;y:number})=>parents.every(p=>Math.abs(point.x-p.x-p.width/2)>=(p.width+child.width)/2+gap-.001||Math.abs(point.y-p.y-p.height/2)>=(p.height+child.height)/2+gap-.001);
 if(clear(preferred))return preferred;
 const xs=[preferred.x],ys=[preferred.y];
 for(const p of parents){xs.push(p.x-child.width/2-gap,p.x+p.width+child.width/2+gap);ys.push(p.y-child.height/2-gap,p.y+p.height+child.height/2+gap);}
 let best=preferred,distance=Infinity;
 for(const x of xs)for(const y of ys){const point={x,y},d=(x-preferred.x)**2+(y-preferred.y)**2;if(d<distance&&clear(point)){best=point;distance=d;}}
 return best;
}

/** Button-triggered editors stay horizontally centered beneath their button.
 * An ancestor in that column can push them down, never sideways or above it. */
export function popupBelowButton(button:PopupRect,child:{width:number;height:number},parents:readonly PopupRect[]=[],gap=4){
 const x=button.x+button.width/2;let top=button.y+button.height+gap;
 for(const p of [...parents].sort((a,b)=>a.y-b.y)){
  if(Math.abs(x-p.x-p.width/2)<(p.width+child.width)/2+gap&&top<p.y+p.height+gap&&top+child.height>p.y-gap)top=p.y+p.height+gap;
 }
 return {x,y:top+child.height/2};
}

/** Nearest clear edge of a scene target, constrained to the available viewport. */
export function popupBesideTarget(target:PopupRect,child:{width:number;height:number},viewport:PopupRect,requested={x:target.x+target.width/2,y:target.y+target.height/2},gap=8){
 const clamp=(n:number,start:number,size:number,available:number)=>Math.max(start,Math.min(n,start+Math.max(0,available-size)));
 const candidates=[{x:target.x-child.width-gap,y:requested.y-child.height/2},{x:target.x+target.width+gap,y:requested.y-child.height/2},{x:requested.x-child.width/2,y:target.y-child.height-gap},{x:requested.x-child.width/2,y:target.y+target.height+gap}];
 let best={x:viewport.x,y:viewport.y},score=Infinity;
 for(const point of candidates){const x=clamp(point.x,viewport.x,child.width,viewport.width),y=clamp(point.y,viewport.y,child.height,viewport.height),overlap=Math.max(0,Math.min(x+child.width,target.x+target.width+gap)-Math.max(x,target.x-gap))*Math.max(0,Math.min(y+child.height,target.y+target.height+gap)-Math.max(y,target.y-gap)),distance=(x+child.width/2-requested.x)**2+(y+child.height/2-requested.y)**2,next=overlap*1e9+distance;if(next<score){best={x,y};score=next;}}
 return best;
}

/** A control editor avoids its opening panel, rather than just the small input. */
export function popupControlTarget(control:HTMLElement):PopupRect{
 const owner=control.closest<HTMLElement>('[data-ui-resident-root],[data-ui-popup-boundary]')??control.closest<HTMLElement>('#tools,.panel,[data-context-controller]')??control;
 const bounds=owner.getBoundingClientRect();return {x:bounds.left,y:bounds.top,width:bounds.width,height:bounds.height};
}
