import type {Vec3,World} from './model.ts';
/** Nearest triangular-lattice site; preserves orthogonal world-axis orientation. */
export function snapSlots(coords:Vec3,active:readonly number[],hex=false,pitch:Vec3=[1,1,1]):Vec3{
 const result=coords.map((n,i)=>active.includes(i)?Math.round(n/pitch[i])*pitch[i]:0) as Vec3;
 if(!hex||active.length!==2)return result;
 const [a,b]=active,rowStep=Math.sqrt(3)/2;let best=Infinity;
 for(let row=Math.round(coords[b]/rowStep)-1;row<=Math.round(coords[b]/rowStep)+1;row++){
  const x=Math.round(coords[a]-row/2)+row/2,y=row*rowStep,d=(x-coords[a])**2+(y-coords[b])**2;
  if(d<best){best=d;result[a]=x;result[b]=y;}
 }
 return result;
}
export function enableDenseFrames(world:World){for(const frame of world.axes??[])frame.packing='hex';}
