import {PIXEL_MOTIF_LIMIT,type MotifFill,type MotifRect,type PixelMotifs} from '../properties/pixelMotifs.ts';
import type {ScenePalette} from './palette.ts';

/** Keep all selected areas in their original coordinate system around one center. */
export function selectedMotifExtent(spatial:ScenePalette['spatial'],owners:readonly number[]):MotifRect|undefined{
 if(!spatial)return;
 const {width,height,cells}=spatial;
 let left=width,right=-1,top=height,bottom=-1;
 for(let i=0;i<cells.length;i++){
  if(!(owners[cells[i]]>=0))continue;
  const x=i%width,y=Math.floor(i/width);
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 if(right<left)return;
 return [left/width,top/height,(right-left+1)/width,(bottom-top+1)/height];
}

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

/** Exact nearest selected source cell, using horizontal sweeps and squared row distances. */
function motifFill(spatial:NonNullable<ScenePalette['spatial']>,owners:readonly number[],crop?:MotifRect):MotifFill|undefined{
 const {width,height,cells}=spatial;
 const seeds=Array.from(cells,(family,at)=>{
  if(!(owners[family]>=0))return false;
  if(!crop)return true;
  const x=(at%width+.5)/width,y=(Math.floor(at/width)+.5)/height;
  return x>=crop[0]&&x<crop[0]+crop[2]&&y>=crop[1]&&y<crop[1]+crop[3];
 });
 if(!seeds.some(Boolean))return crop?motifFill(spatial,owners):undefined;
 // Scan the shorter dimension for the second pass, even on very thin sources.
 const transpose=height>width,columns=Math.max(width,height),rows=Math.min(width,height);
 const at=(x:number,y:number)=>transpose?x*width+y:y*width+x;
 const nearest=new Int32Array(cells.length).fill(-1),result=new Array<string>(cells.length);
 for(let y=0;y<rows;y++){
  let left=-1,right=-1;
  for(let x=0;x<columns;x++){
   if(seeds[at(x,y)])left=x;
   nearest[y*columns+x]=left;
  }
  for(let x=columns-1;x>=0;x--){
   if(seeds[at(x,y)])right=x;
   const left=nearest[y*columns+x];
   if(right>=0&&(left<0||right-x<x-left))nearest[y*columns+x]=right;
  }
 }
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const index=at(x,y);
  let family=cells[index];
  if(!seeds[index]){
   let best=Infinity;
   for(let row=0;row<rows;row++){
    const column=nearest[row*columns+x];
    if(column<0)continue;
    const distance=(row-y)**2+(column-x)**2;
    if(distance<best){best=distance;family=cells[at(column,row)];}
   }
  }
  result[index]=family.toString(16);
 }
 return {width,height,families:result.join('')};
}

export function buildPixelMotifs(spatial:ScenePalette['spatial'],owners:readonly number[],image?:string,crop?:MotifRect):PixelMotifs|undefined{
 if(crop)return {image,owners,fill:spatial&&motifFill(spatial,owners,crop),size:[crop[2],crop[3]],patches:[{source:crop,x:0,y:0}]};
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
 return {image,owners,fill:motifFill(spatial,owners),size:[packedWidth/width,(y+rowHeight)/height],patches};
}
