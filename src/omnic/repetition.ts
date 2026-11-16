/** Repeated units use one source component. In constrained mode the first unit
 * stays at its existing lattice slot; otherwise the line is centered. */
export function repetitionOffset(index:number,count:number,spacing:number,angle:number,anchored:boolean){
 const distance=(anchored?index:index-(count-1)/2)*spacing,radians=(angle-(anchored?90:0))*Math.PI/180;
 return {x:Math.cos(radians)*distance,y:Math.sin(radians)*distance};
}
