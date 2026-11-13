type Size={width:number;height:number};
/** Project obsolete rectangular bounds into a circular default without writing
 * saved layout. A square is an intentional circular resize and stays intact. */
export function circularFrameExtent(visible:Size,saved:Size,initial:Size) {
  return Math.min(visible.width,visible.height,...(saved.width!==saved.height?[initial.width,initial.height]:[]));
}
export function fitFrameShape<T extends Size&{x:number;y:number}>(rect:T,shape?:string):T {
  if(shape!=='circle')return rect;
  const diameter=Math.min(rect.width,rect.height);
  return {...rect,x:rect.x+(rect.width-diameter)/2,y:rect.y+(rect.height-diameter)/2,width:diameter,height:diameter};
}
