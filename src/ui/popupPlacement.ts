export type PopupRect={x:number;y:number;width:number;height:number};
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
