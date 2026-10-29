export type RadialGroup={id:string;label:string;symbol:string;hidden?:boolean;flatten?:boolean};
export type RadialEntry<T>={id:string;label:string;symbol:string;group?:readonly RadialGroup[];content:T;setter?:T};
export type RadialNode<T>=RadialGroup & {children?:RadialNode<T>[];content?:T;setter?:T};
/** Shared presentation grouping; commands/values remain with their existing owner. */
export function radialTree<T>(entries:readonly RadialEntry<T>[]):RadialNode<T>[] {
  const roots:RadialNode<T>[]=[];
  for(const entry of entries){
    if(entry.group?.some(group=>group.hidden))continue;
    let level=roots;
    for(const group of entry.group??[]){
      if(group.flatten)continue;
      let node=level.find(node=>node.id===group.id&&node.children);
      if(!node){node={...group,children:[]};level.push(node);}
      level=node.children!;
    }
    level.push({id:entry.id,label:entry.label,symbol:entry.symbol,content:entry.content,setter:entry.setter});
  }
  return roots;
}
/** One visual policy for root, target, preset, MC and category popup dials. */
export const RADIAL_GEOMETRY={size:32,minimumSize:24,depthStep:4,setterGap:2,opacity:1} as const;
/** A single snapshot supplies both container and slot geometry. Setters consume
 * outer extent only; they never push the buttons away from the centre. */
export function radialLayout<T>(nodes:readonly RadialNode<T>[],depth=0){
  const setterHeight=nodes.some(node=>node.setter)?radialDimensions(depth,nodes.length).size+RADIAL_GEOMETRY.setterGap:0;
  const dimensions=radialDimensions(depth,nodes.length,setterHeight);
  return {...dimensions,slots:nodes.map((_,index)=>{
    const slot=radialSlot(index,nodes.length,depth,setterHeight),angle=index/nodes.length*Math.PI*2;
    return {...slot,setterX:slot.size/2+Math.sin(angle)*(slot.size+RADIAL_GEOMETRY.setterGap),setterY:slot.size/2-Math.cos(angle)*(slot.size+RADIAL_GEOMETRY.setterGap),setterAngle:index/nodes.length*360-90};
  })};
}
/** Only the current category expands. Deeper levels stop shrinking at a usable
 * 24px target; the full path remains available to Back. */
export function radialDimensions(depth:number,count=6,setterHeight=0,centreSize?:number) {
  const size=Math.max(RADIAL_GEOMETRY.minimumSize,RADIAL_GEOMETRY.size-depth*RADIAL_GEOMETRY.depthStep);
  // Fit around the 24px centre, then grow only enough to separate neighbours.
  const radius=Math.max(((centreSize??size)+size)/2,count>1?Math.ceil(size/(2*Math.sin(Math.PI/count))):0);
  return {size,radius,extent:2*(radius+size/2+setterHeight+1)};
}
/** Top then clockwise, independent of the active ring's footprint. */
export function radialSlot(index:number,count:number,depth:number,setterHeight=0) {
  const {radius,extent,size}=radialDimensions(depth,count,setterHeight),turn=index/count*Math.PI*2;
  return {x:50+Math.sin(turn)*radius/extent*100,y:50-Math.cos(turn)*radius/extent*100,size};
}

/** Adjacent quick tools follow the circular rim, starting at top clockwise. */
export function radialQuickSlot(index:number,extent:number,size=24,gap=2) {
  const radius=Math.max(size,extent/2-size/2-2),angle=index*2*Math.asin(Math.min(1,(size+gap)/(2*radius)));
  return {x:50+Math.sin(angle)*radius/extent*100,y:50-Math.cos(angle)*radius/extent*100,size};
}
