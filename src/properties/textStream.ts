/** One logical text stream. Newlines and whitespace-only paragraphs consume no distance. */
export function textStream(text:string,measure:(text:string)=>number){
 const rows:{from:number;to:number;start:number;width:number;text:string}[]=[];let from=0,total=0;
 for(const line of text.split('\n')){const width=line.trim()?measure(line):0;rows.push({from,to:from+line.length,start:total,width,text:line});total+=width;from+=line.length+1;}
 return {total,position(at:number){let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(rows[mid].from<=at)lo=mid;else hi=mid-1;}const row=rows[lo];return row.start+(row.width?measure(row.text.slice(0,Math.max(0,Math.min(row.text.length,at-row.from)))):0);}};
}
/** Native texture rows use the same concatenation: crop outside first/last ink, retain internal spacing. */
export function textureTextStream(width:number,height:number,pixels:ArrayLike<number>,rows:readonly number[],channel=0,stride=4){
 const table=new Float32Array((rows.length-1)*4);let total=0;
 for(let row=0;row<rows.length-1;row++){let first=width,last=-1;for(let y=rows[row];y<Math.min(height,rows[row+1]);y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*stride+channel]>0){first=Math.min(first,x);last=Math.max(last,x);}const length=Math.max(0,last-first+1);table.set([total,length?first:0,length,0],row*4);total+=length;}
 return {table,total};
}
