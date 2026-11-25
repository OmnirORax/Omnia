import {PIXEL_MOTIF_LIMIT,type MotifRect,type PixelMotifs} from '../properties/pixelMotifs.ts';
import type {ScenePalette} from './palette.ts';

/** Find islands in the existing bounded color map. One empty cell can separate neighbors. */
function groupPixelMotifs({width,height,cells}:NonNullable<ScenePalette['spatial']>,owners:readonly number[]){
 const visited=new Uint8Array(cells.length),queue=new Int32Array(cells.length);
 const shapes:{x:number;y:number;width:number;height:number;count:number}[]=[];
 for(let start=0;start<cells.length;start++){
  if(visited[start]||!(owners[cells[start]]>=0))continue;
  let head=0,count=1,left=width,right=0,top=height,bottom=0;
  queue[0]=start;visited[start]=1;
  while(head<count){
   const at=queue[head++],x=at%width,y=Math.floor(at/width);
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    if(Math.abs(dx)+Math.abs(dy)>2)continue;
    const nx=x+dx,ny=y+dy;
    if(nx<0||nx>=width||ny<0||ny>=height)continue;
    const next=ny*width+nx;
    if(visited[next]||!(owners[cells[next]]>=0))continue;
    visited[next]=1;queue[count++]=next;
   }
  }
  const x=Math.max(0,left-1),y=Math.max(0,top-1);
  shapes.push({x,y,width:Math.min(width,right+2)-x,height:Math.min(height,bottom+2)-y,count});
 }
 return shapes.sort((a,b)=>b.count-a.count).slice(0,PIXEL_MOTIF_LIMIT);
}

export function buildPixelMotifs(spatial:ScenePalette['spatial'],owners:readonly number[],image?:string,crop?:MotifRect):PixelMotifs|undefined{
 if(crop)return {image,owners,size:[crop[2],crop[3]],patches:[{source:crop,x:0,y:0}]};
 if(!spatial)return;
 const shapes=groupPixelMotifs(spatial,owners);
 if(!shapes.length)return;
 const {width,height}=spatial;
 const rowWidth=Math.max(...shapes.map(shape=>shape.width),Math.ceil(Math.sqrt(shapes.reduce((sum,shape)=>sum+(shape.width+1)*(shape.height+1),0))));
 let x=0,y=0,rowHeight=0,packedWidth=0;
 const patches=shapes.sort((a,b)=>b.height-a.height).map(shape=>{
  if(x&&x+shape.width>rowWidth){x=0;y+=rowHeight+1;rowHeight=0;}
  const source:MotifRect=[shape.x/width,shape.y/height,shape.width/width,shape.height/height];
  const patch={source,x:x/width,y:y/height};
  packedWidth=Math.max(packedWidth,x+shape.width);rowHeight=Math.max(rowHeight,shape.height);x+=shape.width+1;
  return patch;
 });
 return {image,owners,size:[packedWidth/width,(y+rowHeight)/height],patches};
}
