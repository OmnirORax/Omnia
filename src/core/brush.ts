import type {Vec3} from './model.ts';
export type Brush={kind:'cube';size:Vec3;unit?:Brush}|{kind:'sphere';radius:number;unit?:Brush};
export const SINGLE_BRUSH:Brush={kind:'cube',size:[1,1,1]};
export function parseBrush(text:string,unit?:Brush):Brush{
 const value=text.trim().toLowerCase(),sphere=/^(?:sphere|r)\s*([\d.]+)$/.exec(value),cube=/^(\d+)(?:\s*[x×]\s*(\d+)\s*[x×]\s*(\d+))?$/.exec(value);
 const brush:Brush=sphere?{kind:'sphere',radius:Number(sphere[1]),unit}:cube?{kind:'cube',size:[Number(cube[1]),Number(cube[2]??cube[1]),Number(cube[3]??cube[1])],unit}:(()=>{throw Error('Enter a size, 2×2×2, or sphere 2.');})();
 brushShape(brush);return brush;
}
const cache=new Map<string,{points:Vec3[];pitch:Vec3}>();
function validateBrush(brush:Brush,depth=0):void{
 if(!brush||typeof brush!=='object'||depth>12)throw Error('Brush nesting exceeds 12 levels.');
 if(brush.kind==='cube'){if(!Array.isArray(brush.size)||brush.size.length!==3||brush.size.some(n=>!Number.isInteger(n)||n<1||n>64))throw Error('Cube sizes must be whole numbers from 1 to 64.');}
 else if(brush.kind==='sphere'){if(!Number.isInteger(brush.radius)||brush.radius<0||brush.radius>32)throw Error('Sphere radius must be a whole number from 0 to 32.');}
 else throw Error('Invalid brush geometry.');
 if(brush.unit!==undefined)validateBrush(brush.unit,depth+1);
}
/** Expand only the bounded stamp, retaining recursive construction as the owner. */
export function brushShape(brush:Brush,depth=0):{points:Vec3[];pitch:Vec3}{
 validateBrush(brush,depth);const signature=JSON.stringify(brush);const known=cache.get(signature);if(known)return known;
 if(!brush||depth>12)throw Error('Brush nesting exceeds 12 levels.');
 const child=brush.unit?brushShape(brush.unit,depth+1):{points:[[0,0,0]] as Vec3[],pitch:[1,1,1] as Vec3};
 const macro:Vec3[]=[];
 if(brush.kind==='cube'){
  if(!Array.isArray(brush.size)||brush.size.length!==3||brush.size.some(n=>!Number.isInteger(n)||n<1||n>64))throw Error('Cube sizes must be whole numbers from 1 to 64.');
  if(brush.size.reduce((a,b)=>a*b,1)*child.points.length>4000)throw Error('A brush can contain up to 4,000 nodes.');
  for(let x=0;x<brush.size[0];x++)for(let y=0;y<brush.size[1];y++)for(let z=0;z<brush.size[2];z++)macro.push([x,y,z]);
 }else if(brush.kind==='sphere'){
  if(!Number.isInteger(brush.radius)||brush.radius<0||brush.radius>32)throw Error('Sphere radius must be a whole number from 0 to 32.');
  const r=brush.radius;for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)for(let z=-r;z<=r;z++)if(x*x+y*y+z*z<=r*r){macro.push([x,y,z]);if(macro.length*child.points.length>4000)throw Error('A brush can contain up to 4,000 nodes.');}
 }else throw Error('Invalid brush geometry.');
 const points:Vec3[]=macro.flatMap(p=>child.points.map(q=>p.map((n,i)=>n*child.pitch[i]+q[i]) as Vec3));
 const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),pitch=max.map((n,i)=>n-min[i]+1) as Vec3;
 const shift=min.map((n,i)=>n+Math.floor(pitch[i]/2));for(const p of points)for(let i=0;i<3;i++)p[i]-=shift[i];
 const shape={points,pitch};if(cache.size>=16)cache.delete(cache.keys().next().value!);cache.set(signature,shape);return shape;
}
