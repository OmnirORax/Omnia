import type {XYZ} from './geometryTypes.ts';
/** Physical occupancy in sparse buckets; visibility never releases a position. */
export function createOccupancy(entries:Iterable<readonly [string,XYZ]>,unit=1){
 const bins=new Map<string,{id:string;point:XYZ}[]>();
 const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
 const add=(id:string,point:XYZ)=>{const k=key(Math.floor(point.x/unit),Math.floor(point.y/unit),Math.floor(point.z/unit)),bin=bins.get(k)??[];bin.push({id,point});bins.set(k,bin);};
 for(const [id,point]of entries)add(id,point);
 const blocker=(point:XYZ,exclude?:ReadonlySet<string>)=>{
  const x=Math.floor(point.x/unit),y=Math.floor(point.y/unit),z=Math.floor(point.z/unit);
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)for(const other of bins.get(key(x+i,y+j,z+k))??[]){
   if(exclude?.has(other.id))continue;
   const p=other.point;if((p.x-point.x)**2+(p.y-point.y)**2+(p.z-point.z)**2<unit*unit*(1-1e-8))return other.id;
  }
  return undefined;
 };
 return {add,blocker,free(point:XYZ,exclude?:ReadonlySet<string>){return [point.x,point.y,point.z].every(Number.isFinite)&&blocker(point,exclude)===undefined;}};
}
