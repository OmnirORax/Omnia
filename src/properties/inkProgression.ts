import {focusPattern} from './focusPalette.ts';
import type {TextPalette} from './textPalette.ts';
export type InkScan={width:number;height:number;axis:0|1;major:number;rows:readonly number[];ranks:Uint32Array;columns:Float32Array};
/** Occupied columns climb/descend; occupied rows sweep left/right. Spaces never advance or turn the scan. */
export function scanInk(width:number,height:number,pixels:ArrayLike<number>,channel=3,stride=4,rows:readonly number[]=[0,height],axis:0|1=0):InkScan{
 const major=axis===1?Math.max(...rows.slice(1).map((end,i)=>end-rows[i])):width,ranks=new Uint32Array(width*height),columns=new Float32Array(major*(rows.length-1)*4),pixel=(a:number,b:number)=>axis===1?a*width+b:b*width+a;
 for(let row=0;row<rows.length-1;row++){
  const firstMajor=axis===1?rows[row]:0,lastMajor=axis===1?rows[row+1]:width,firstMinor=axis===1?0:rows[row],lastMinor=axis===1?width:rows[row+1];let ordinal=0,occupied=0,previous=-1,first=-1;
  for(let a=firstMajor;a<lastMajor;a++){
   let count=0;for(let b=firstMinor;b<lastMinor;b++)if(pixels[pixel(a,b)*stride+channel]>0)count++;
   const at=(row*major+a-firstMajor)*4;
   if(count){if(first<0)first=a;columns.set([ordinal,count,occupied,0],at);let rank=0;for(let b=firstMinor;b<lastMinor;b++){const index=pixel(a,b);ranks[index]=Math.min(rank,count-1);if(pixels[index*stride+channel]>0)rank++;}ordinal+=count;occupied++;previous=a;}
   else if(previous>=0){columns.set(columns.subarray((row*major+previous-firstMajor)*4,(row*major+previous-firstMajor+1)*4),at);for(let b=firstMinor;b<lastMinor;b++)ranks[pixel(a,b)]=ranks[pixel(previous,b)];}
  }
  if(first>firstMajor)for(let a=firstMajor;a<first;a++){columns.set(columns.subarray((row*major+first-firstMajor)*4,(row*major+first-firstMajor+1)*4),(row*major+a-firstMajor)*4);for(let b=firstMinor;b<lastMinor;b++)ranks[pixel(a,b)]=ranks[pixel(first,b)];}
 }
 return {width,height,axis,major,rows,ranks,columns};
}
export function inkPosition(scan:InkScan,x:number,y:number,row=0){const at=(row*scan.major+(scan.axis===1?y-scan.rows[row]:x))*4,count=scan.columns[at+1],rank=scan.ranks[y*scan.width+x],reverse=scan.columns[at+2]%2===(scan.axis===1?1:0);return scan.columns[at]+(reverse?Math.max(0,count-1-rank):rank);}
/** Recoloring reuses glyph coordinates; only text/layout changes need another scan. */
export function paintInkScan(scan:InkScan,p:TextPalette,indexed=false){
 const pattern=focusPattern(p),colors=new Uint32Array(pattern.ink.buffer,pattern.ink.byteOffset,pattern.ink.byteLength/4),result=new Uint8ClampedArray(scan.width*scan.height*4),output=new Uint32Array(result.buffer),scale=p.scale??1;
 const indices=indexed?Uint8Array.from(pattern.indices,i=>Math.ceil(i/p.colors.length*255)):undefined;
 for(let row=0;row<scan.rows.length-1;row++)for(let y=scan.rows[row];y<scan.rows[row+1];y++)for(let x=0;x<scan.width;x++){const source=Math.floor(inkPosition(scan,x,y,row)/scale)%pattern.indices.length,at=y*scan.width+x;if(indices){const gray=indices[source];result[at*4]=result[at*4+1]=result[at*4+2]=gray;result[at*4+3]=255;}else output[at]=colors[source];}
 return result;
}
