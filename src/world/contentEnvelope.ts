export type Point2={x:number;y:number};
export function convexHull(points:readonly Point2[]):Point2[]{
 const sorted=[...points].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).sort((a,b)=>a.x-b.x||a.y-b.y);
 const unique=sorted.filter((p,n)=>!n||p.x!==sorted[n-1].x||p.y!==sorted[n-1].y);
 if(unique.length<3)return unique;
 const cross=(a:Point2,b:Point2,c:Point2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const half=(items:Point2[])=>{const result:Point2[]=[];for(const p of items){while(result.length>1&&cross(result.at(-2)!,result.at(-1)!,p)<=0)result.pop();result.push(p);}result.pop();return result;};
 return [...half(unique),...half([...unique].reverse())];
}
/** One padded outer envelope: letter holes and gaps never become separate nodes.
 * Fixed support directions give circle/content outlines the same bounded topology. */
export function contentEnvelope(points:readonly Point2[],padding:number,sides=64):Point2[]{
 if(!points.length)return [];
 const normals=Array.from({length:sides},(_,n)=>({x:Math.cos(n*2*Math.PI/sides),y:Math.sin(n*2*Math.PI/sides)}));
 const support=normals.map(v=>Math.max(...points.map(p=>p.x*v.x+p.y*v.y))+padding);
 return normals.map((a,n)=>{const b=normals[(n+1)%sides],sa=support[n],sb=support[(n+1)%sides],det=a.x*b.y-a.y*b.x;return {x:(sa*b.y-sb*a.y)/det,y:(a.x*sb-b.x*sa)/det};});
}
/** Bounded alpha scan; scanline extremes suffice for the convex outer envelope. */
export function alphaHull(data:Uint8ClampedArray,width:number,height:number){
 const points:Point2[]=[];
 const add=(x:number,y:number)=>points.push({x:x/width-.5,y:.5-y/height});
 for(let y=0;y<height;y++){let first=-1,last=-1;for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=16){if(first<0)first=x;last=x;}
  if(first>=0){add(first,y);add(last+1,y);add(first,y+1);add(last+1,y+1);}
 }
 return convexHull(points);
}
export function imageHull(image:CanvasImageSource){
 const source=image as {naturalWidth?:number;naturalHeight?:number;width?:number;height?:number},w=source.naturalWidth||source.width||0,h=source.naturalHeight||source.height||0;if(!w||!h)return [];
 const ratio=Math.min(1,256/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return [];
 try{context.drawImage(image,0,0,canvas.width,canvas.height);return alphaHull(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);}catch{return [];}
}
