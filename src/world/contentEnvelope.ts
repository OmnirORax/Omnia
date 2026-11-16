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
/** Offset the actual convex ink boundary, retaining every straight-edge normal.
 * Only the rounded joins are subdivided (at most one sixteenth-turn per arc).
 * Offsets share topology, so the antialiased stroke can use matched strips. */
export function inkEnvelope(points:readonly Point2[],padding:number):Point2[]{
 const hull=convexHull(points);if(!hull.length)return [];
 if(hull.length===1)return contentEnvelope(hull,padding);
 const result:Point2[]=[];
 for(let n=0;n<hull.length;n++){
  const p=hull[n],before=hull[(n+hull.length-1)%hull.length],after=hull[(n+1)%hull.length];
  const start=Math.atan2(-(p.x-before.x),p.y-before.y);let end=Math.atan2(-(after.x-p.x),after.y-p.y);
  while(end<start-1e-12)end+=Math.PI*2;
  const steps=Math.max(1,Math.ceil((end-start)/(Math.PI/16)));
  for(let i=0;i<=steps;i++){const angle=start+(end-start)*i/steps;result.push({x:p.x+Math.cos(angle)*padding,y:p.y+Math.sin(angle)*padding});}
 }
 return result;
}
/** Matched offsets for an ordered silhouette. Bounded miters avoid spikes. */
export function boundaryOffset(points:readonly Point2[],padding:number){
 return points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],la=Math.hypot(p.x-a.x,p.y-a.y)||1,lb=Math.hypot(b.x-p.x,b.y-p.y)||1,ax=(p.y-a.y)/la,ay=-(p.x-a.x)/la,bx=(b.y-p.y)/lb,by=-(b.x-p.x)/lb,den=1+ax*bx+ay*by;const factor=Math.min(2,1/Math.max(.01,den));return {x:p.x+(ax+bx)*padding*factor,y:p.y+(ay+by)*padding*factor};});
}
