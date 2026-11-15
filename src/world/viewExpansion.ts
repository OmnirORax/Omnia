export type Extent={width:number;height:number};
export type ExpansionItem={id:string;x:number;y:number;label:Extent;glyph?:Extent;rotate?:boolean};
export function expansionFootprint(item:ExpansionItem,turn=false){
 const glyph=item.glyph,gw=glyph?(turn?glyph.height:glyph.width):0,gh=glyph?(turn?glyph.width:glyph.height):0;
 const gap=gh&&item.label.height?8:0;
 return {width:Math.max(gw,item.label.width,1)+12,height:gh+item.label.height+gap+12,glyphWidth:gw,glyphHeight:gh,gap};
}
/** A common similarity transform preserves every projected axis and ordering.
 * Content bounds, never carrier units, determine expansion and common fitting.
 * Work is bounded; very dense views use a conservative separation bound. */
export function expandView(items:readonly ExpansionItem[],width:number,height:number,padding=12){
 const valid=items.filter(i=>[i.x,i.y,i.label.width,i.label.height,i.glyph?.width??0,i.glyph?.height??0].every(Number.isFinite));
 const ordered=[...valid].sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
 // Exact projection ties have no screen ordering. Give distinct depth slots a
 // deterministic tiny offset before fitting; never mutate the authored inputs.
 let separation=1;for(const axis of ['x','y'] as const){const values=[...new Set(ordered.map(i=>i[axis]))].sort((a,b)=>a-b);for(let n=1;n<values.length;n++)separation=Math.min(separation,values[n]-values[n-1]);}
 const anchors=ordered.map(i=>({...i}));
 for(let first=0;first<anchors.length;){let end=first+1;while(end<anchors.length&&ordered[end].x===ordered[first].x&&ordered[end].y===ordered[first].y)end++;
  for(let n=first;n<end;n++){anchors[n].x+=(n-first-(end-first-1)/2)*separation*.01/(end-first);anchors[n].y+=(n-first-(end-first-1)/2)*separation*.01/(end-first);}first=end;
 }
 anchors.sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));
 const rotations=new Set<string>();
 for(const axis of ['x','y'] as const){
  const sorted=[...anchors].sort((a,b)=>a[axis]-b[axis]||a.id.localeCompare(b.id));
  for(let n=0;n<sorted.length;n++){
   const item=sorted[n];if(!item.rotate||!item.glyph)continue;
   const candidates=[sorted[n-1],sorted[n+1]].filter((v):v is ExpansionItem=>!!v);
   const nearest=candidates.sort((a,b)=>Math.hypot(a.x-item.x,a.y-item.y)-Math.hypot(b.x-item.x,b.y-item.y))[0];if(!nearest)continue;
   const dx=Math.abs(nearest.x-item.x),dy=Math.abs(nearest.y-item.y),normal=expansionFootprint(item),turned=expansionFootprint(item,true);
   if(dx*turned.width+dy*turned.height<(dx*normal.width+dy*normal.height)*.95)rotations.add(item.id);
  }
 }
 const solve=(turns:ReadonlySet<string>)=>{
  const boxes=anchors.map(i=>({...i,...expansionFootprint(i,turns.has(i.id))}));
  if(!boxes.length)return {scale:1,spacing:1,positions:new Map<string,{x:number;y:number;scale:number;turn:boolean;width:number;height:number}>()};
  const maxWidth=Math.max(...boxes.map(i=>i.width)),maxHeight=Math.max(...boxes.map(i=>i.height));
  let spacing=1,work=0,limited=false;
  pair:for(let n=0;n<boxes.length;n++)for(let m=n+1;m<boxes.length;m++){
   const a=boxes[n],b=boxes[m],dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
   if(dx*spacing>maxWidth)break;
   if(++work>65536){limited=true;break pair;}
   const required=Math.min(dx?(a.width+b.width)/2/dx:Infinity,dy?(a.height+b.height)/2/dy:Infinity);
   if(Number.isFinite(required))spacing=Math.max(spacing,required);
  }
  if(limited){
   const minGap=(axis:'x'|'y')=>{const values=[...new Set(boxes.map(i=>i[axis]))].sort((a,b)=>a-b);let gap=Infinity;for(let n=1;n<values.length;n++)gap=Math.min(gap,values[n]-values[n-1]);return gap;};
   spacing=Math.max(spacing,maxWidth/minGap('x'),maxHeight/minGap('y'));
  }
  const cx=(Math.min(...boxes.map(i=>i.x))+Math.max(...boxes.map(i=>i.x)))/2,cy=(Math.min(...boxes.map(i=>i.y))+Math.max(...boxes.map(i=>i.y)))/2;
  const left=Math.min(...boxes.map(i=>(i.x-cx)*spacing-i.width/2)),right=Math.max(...boxes.map(i=>(i.x-cx)*spacing+i.width/2));
  const top=Math.min(...boxes.map(i=>(i.y-cy)*spacing-i.height/2)),bottom=Math.max(...boxes.map(i=>(i.y-cy)*spacing+i.height/2));
  const pad=Math.min(padding,width/4,height/4),scale=Math.min(1,Math.max(1,width-2*pad)/(right-left),Math.max(1,height-2*pad)/(bottom-top));
  const ox=Math.max(pad-left*scale,Math.min(width-pad-right*scale,cx)),oy=Math.max(pad-top*scale,Math.min(height-pad-bottom*scale,cy));
  const positions=new Map(boxes.map(i=>[i.id,{x:ox+(i.x-cx)*spacing*scale,y:oy+(i.y-cy)*spacing*scale,scale,turn:turns.has(i.id),width:i.width*scale,height:i.height*scale}]));
  return {scale,spacing,positions};
 };
 const normal=solve(new Set());if(!rotations.size)return normal;
 const rotated=solve(rotations);return rotated.scale>normal.scale*1.02?rotated:normal;
}
