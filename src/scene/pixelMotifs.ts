import {PIXEL_MOTIF_LIMIT,type MotifFill,type MotifRect,type PixelMotifs} from '../properties/pixelMotifs.ts';
import type {ScenePalette} from './palette.ts';

/** Center the selected color coverage without moving the surviving shapes relative to each other. */
export function buildCenteredPixelMotifs(spatial:ScenePalette['spatial'],owners:readonly number[],image?:string,crop?:MotifRect):PixelMotifs|undefined{
 if(!spatial)return buildPixelMotifs(spatial,owners,image,crop);
 const {width,height,cells}=spatial;
 const [cropX,cropY,cropW,cropH]=crop??[0,0,1,1];
 let left=1,right=0,top=1,bottom=0,total=0,sumX=0,sumY=0;
 for(let i=0;i<cells.length;i++){
  if(!(owners[cells[i]]>=0))continue;
  const x=i%width,y=Math.floor(i/width);
  const x0=Math.max(x/width,cropX),x1=Math.min((x+1)/width,cropX+cropW);
  const y0=Math.max(y/height,cropY),y1=Math.min((y+1)/height,cropY+cropH);
  if(x0>=x1||y0>=y1)continue;
  const area=(x1-x0)*(y1-y0);
  total+=area;sumX+=area*(x0+x1)/2;sumY+=area*(y0+y1)/2;
  left=Math.min(left,x0);right=Math.max(right,x1);top=Math.min(top,y0);bottom=Math.max(bottom,y1);
 }
 if(!total)return buildPixelMotifs(spatial,owners,image,crop);
 const source:MotifRect=[left,top,right-left,bottom-top];
 const offsetX=sumX/total-left,offsetY=sumY/total-top;
 // Fit the farthest edge on each axis so the complete selection stays visible at 1×.
 const halfWidth=Math.max(offsetX,source[2]-offsetX),halfHeight=Math.max(offsetY,source[3]-offsetY);
 return {image,owners,fill:motifFill(spatial,owners,source),size:[2*halfWidth,2*halfHeight],
  patches:[{source,x:halfWidth-offsetX,y:halfHeight-offsetY}]};
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
