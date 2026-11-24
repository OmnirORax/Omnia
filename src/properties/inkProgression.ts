import {focusPattern} from './focusPalette.ts';
import type {TextPalette} from './textPalette.ts';
export type InkScan={width:number;height:number;rows:readonly number[];ranks:Uint32Array;columns:Float32Array};
/** Column-major serpentine over occupied pixels. Empty columns do not turn the scan. */
export function scanInk(width:number,height:number,pixels:ArrayLike<number>,channel=3,stride=4,rows:readonly number[]=[0,height]):InkScan{
 const ranks=new Uint32Array(width*height),columns=new Float32Array(width*(rows.length-1)*4);
 for(let row=0;row<rows.length-1;row++){
  const top=rows[row],bottom=rows[row+1];let ordinal=0,occupied=0,previous=-1,first=-1;
  for(let x=0;x<width;x++){
   let count=0;for(let y=top;y<bottom;y++)if(pixels[(y*width+x)*stride+channel]>0)count++;
   const at=(row*width+x)*4;
   if(count){if(first<0)first=x;columns.set([ordinal,count,occupied,0],at);let rank=0;for(let y=top;y<bottom;y++){ranks[y*width+x]=Math.min(rank,count-1);if(pixels[(y*width+x)*stride+channel]>0)rank++;}ordinal+=count;occupied++;previous=x;}
   else if(previous>=0){columns.set(columns.subarray((row*width+previous)*4,(row*width+previous+1)*4),at);for(let y=top;y<bottom;y++)ranks[y*width+x]=ranks[y*width+previous];}
  }
  if(first>0)for(let x=0;x<first;x++){columns.set(columns.subarray((row*width+first)*4,(row*width+first+1)*4),(row*width+x)*4);for(let y=top;y<bottom;y++)ranks[y*width+x]=ranks[y*width+first];}
 }
 return {width,height,rows,ranks,columns};
}
export function inkPosition(scan:InkScan,x:number,y:number,row=0){const at=(row*scan.width+x)*4,count=scan.columns[at+1],rank=scan.ranks[y*scan.width+x];return scan.columns[at]+(scan.columns[at+2]%2===0?Math.max(0,count-1-rank):rank);}
/** Recoloring reuses glyph coordinates; only text/layout changes need another scan. */
export function paintInkScan(scan:InkScan,p:TextPalette,indexed=false){
 const pattern=focusPattern(p),colors=new Uint32Array(pattern.ink.buffer,pattern.ink.byteOffset,pattern.ink.byteLength/4),result=new Uint8ClampedArray(scan.width*scan.height*4),output=new Uint32Array(result.buffer),scale=p.scale??1;
 const indices=indexed?Uint8Array.from(pattern.indices,i=>Math.floor((i+.5)/p.colors.length*255)):undefined;
 for(let row=0;row<scan.rows.length-1;row++)for(let y=scan.rows[row];y<scan.rows[row+1];y++)for(let x=0;x<scan.width;x++){const source=Math.floor(inkPosition(scan,x,y,row)/scale)%pattern.indices.length,at=y*scan.width+x;if(indices){const gray=indices[source];result[at*4]=result[at*4+1]=result[at*4+2]=gray;result[at*4+3]=255;}else output[at]=colors[source];}
 return result;
}
