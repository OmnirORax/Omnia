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
  // Bound crowding as applicable controls grow; overflow stays reachable.
  const compact=(nodes:RadialNode<T>[]):RadialNode<T>[]=>{
    const mapped=nodes.map(node=>node.children?{...node,children:compact(node.children)}:node);
    return mapped.length<=6?mapped:[...mapped.slice(0,5),{id:`more:${mapped[5].id}`,label:'More tools',symbol:'⋯',children:compact(mapped.slice(5))}];
  };
  return compact(roots);
}
/** Only the current category expands. Deeper levels stop shrinking at a usable
 * 24px target; the full path remains available to Back. */
export function radialDimensions(depth:number,count=6,setterHeight=0) {
  const size=depth===0?32:depth===1?28:24;
  // Fit around the 24px centre, then grow only enough to separate neighbours.
  const radius=Math.max(12+size/2,count>1?Math.ceil(Math.ceil(size/(2*Math.sin(Math.PI/count)))):0);
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
