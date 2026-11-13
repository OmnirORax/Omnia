import {regionDiscPath} from '../properties/regionShape.ts';
import {nodeRegionBounds} from './fillRegion.ts';
import {convexInkTouches} from '../appearance/geometryRelations.ts';
import {regionContains} from '../properties/regionField.ts';
import type { Evaluation, StructuralNode } from "./evaluate.ts";
const esc=(text:string)=>text.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
const number=(value:number)=>String(Math.round(value*10000)/10000);
/** Renderer-node hit testing: use the same evaluated geometry, never raw recipe
 * coordinates or inferred pixels. Only runs on a pick, not on pointer movement. */
export function pickStructuralNode(nodes:readonly StructuralNode[],point:{x:number;y:number},role?:string) {
  if(role){const exact=nodes.find(n=>n.id===role&&n.kind!=='group');if(exact)return exact;}
  let best:StructuralNode|undefined,score=Infinity;
  for(const node of nodes){
    if(node.kind==='group'||node.clip&&!regionContains(node.clip,point))continue;
    let distance=Math.hypot(point.x-node.x,point.y-node.y);
    if(node.kind==='line'){
      const dx=(node.x2??node.x)-node.x,dy=(node.y2??node.y)-node.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((point.x-node.x)*dx+(point.y-node.y)*dy)/length)):0;
      distance=Math.hypot(point.x-node.x-t*dx,point.y-node.y-t*dy);
    }else distance=(node.fill||distance<=node.radius&&node.fillRegions?.some(region=>region.opacity>0&&regionContains(region.points,point)))?Math.max(0,distance-node.radius):Math.abs(distance-node.radius);
    if(distance<=Math.max(2,node.thickness/2)&&distance<score){best=node;score=distance;}
  }
  return best;
}
/** Exact segment sweep over rendered primitives, called only during selection gestures. */
export function structuralIdsAlong(nodes:readonly StructuralNode[],a:{x:number;y:number},b:{x:number;y:number}):Set<string>{
  const distance=(p:typeof a,u:typeof a,v:typeof a)=>{const dx=v.x-u.x,dy=v.y-u.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/d)):0;return Math.hypot(p.x-u.x-t*dx,p.y-u.y-t*dy);};
  const cross=(u:typeof a,v:typeof a,w:typeof a)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x);
  const ids=new Set<string>();
  for(const n of nodes){
    if(n.kind==='group')continue;
    const c={x:n.x,y:n.y},t=Math.max(2,n.thickness/2);
    let hit=false;
    if(n.kind==='line'){
      const d={x:n.x2??n.x,y:n.y2??n.y};
      const intersects=Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
      hit=intersects||Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))<=t;
    }else{const nearest=distance(c,a,b),furthest=Math.max(Math.hypot(a.x-c.x,a.y-c.y),Math.hypot(b.x-c.x,b.y-c.y));hit=nearest<=n.radius+t&&(n.fill||furthest>=n.radius-t);}
    if(hit)ids.add(n.componentId);
  }
  return ids;
}
/** Components intersecting the normalized rectangular selection marquee. */
export function structuralIdsInRect(nodes:readonly StructuralNode[],a:{x:number;y:number},b:{x:number;y:number}):Set<string>{
  const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y),ids=new Set<string>();
  for(const n of nodes){if(n.kind==='group')continue;if(n.clip){if(convexInkTouches({kind:'circle',center:{x:n.x,y:n.y},radius:n.radius,clip:n.clip},{kind:'polygon',points:[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}]}))ids.add(n.componentId);continue;}const t=Math.max(2,n.thickness/2);let hit=false;
    if(n.kind==='line'){
      let low=0,high=1;hit=true;
      for(const [start,delta,min,max] of [[n.x,(n.x2??n.x)-n.x,left-t,right+t],[n.y,(n.y2??n.y)-n.y,top-t,bottom+t]]){
        if(Math.abs(delta)<1e-12){if(start<min||start>max){hit=false;break;}}
        else{const a=(min-start)/delta,b=(max-start)/delta;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high){hit=false;break;}}
      }
    }
    else{const nx=Math.max(left,Math.min(right,n.x)),ny=Math.max(top,Math.min(bottom,n.y)),nearest=Math.hypot(nx-n.x,ny-n.y),furthest=Math.max(...[[left,top],[left,bottom],[right,top],[right,bottom]].map(([x,y])=>Math.hypot(x!-n.x,y!-n.y)));hit=nearest<=n.radius+t&&(n.fill||furthest>=n.radius-t);}
    if(hit)ids.add(n.componentId);
  }return ids;
}
export function evaluationBounds(evaluation:Evaluation) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const node of evaluation.nodes){
    if(node.kind==="group")continue;
    const box=nodeRegionBounds(node);if(!box)continue;
    minX=Math.min(minX,box.left);minY=Math.min(minY,box.top);maxX=Math.max(maxX,box.right);maxY=Math.max(maxY,box.bottom);
  }
  if(!Number.isFinite(minX))return {x:-50,y:-50,width:100,height:100};
  const width=Math.max(20,maxX-minX),height=Math.max(20,maxY-minY);
  return {x:(minX+maxX-width)/2-12,y:(minY+maxY-height)/2-12,width:width+24,height:height+24};
}
function element(node:StructuralNode,selected:boolean) {
  if(node.kind==="group")return "";
  const attrs=`data-selection-geometry="" data-selection-boundary="" data-selection-id="${esc(node.id)}" data-omnic-role="${esc(node.id)}" data-omnic-component="${esc(node.componentId)}" aria-label="${esc(node.id)}" style="${node.glow?`color:${esc(node.color)};filter:drop-shadow(0 0 2px currentColor);`:""}fill:${node.fill?esc(node.color):"none"};stroke:${esc(node.color)}" stroke="${esc(node.color)}" stroke-width="${number(node.thickness)}" opacity="${number(node.opacity)}" fill="${node.fill?esc(node.color):"none"}"${selected?' data-omnic-selected="true"':''}`;
  const title='';
  const disc=node.clip?{x:node.x,y:node.y,radius:node.radius,clip:node.clip,color:node.color,opacity:node.opacity}:undefined;
  const path=disc?regionDiscPath(disc):undefined;if(disc&&!path)return '';
  let base = disc?`<path ${attrs} data-selection-disc="${esc(JSON.stringify([disc]))}" d="${path}">${title}</path>`:node.kind==="line"?`<line ${attrs} x1="${number(node.x)}" y1="${number(node.y)}" x2="${number(node.x2??node.x)}" y2="${number(node.y2??node.y)}" stroke-linecap="${node.cap??"round"}">${title}</line>`:`<circle ${attrs} cx="${number(node.x)}" cy="${number(node.y)}" r="${number(node.radius)}">${title}</circle>`;
  if(node.fillRegions?.length){
    const key=Array.from(node.id).map(c=>c.codePointAt(0)!.toString(16)).join('-');
    const regions=node.fillRegions.map((region,index)=>{const clip=Array.from(JSON.stringify(region.points)).map(c=>c.codePointAt(0)!.toString(16)).join('-'),id=`region-${key}-${index}-${clip}`;return `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><polygon points="${region.points.map(p=>`${number(p.x)},${number(p.y)}`).join(' ')}"/></clipPath><circle data-selection-ink="" clip-path="url(#${id})" cx="${number(node.x)}" cy="${number(node.y)}" r="${number(node.radius)}" fill="${esc(region.color)}" opacity="${number(region.opacity)}"/>`;}).join('');
    base=`<g opacity="${number(node.opacity)}" data-selection-boundary data-selection-id="${esc(node.id)}" data-omnic-role="${esc(node.id)}" data-omnic-component="${esc(node.componentId)}">${regions}${base.replace(`opacity="${number(node.opacity)}"`,'opacity="1"')}</g>`;
  }
  const mark=node.highlight;
  if(!mark||mark.fraction<=0)return base;
  const paint=`stroke="${esc(mark.color)}" stroke-width="${number(node.thickness)}" opacity="${number(mark.opacity)}"`;
  let overlay:string;
  if(node.kind==="line")overlay=`<line ${paint} x1="${number(node.x)}" y1="${number(node.y)}" x2="${number(node.x2??node.x)}" y2="${number(node.y2??node.y)}" />`;
  else if(mark.fraction===1)overlay=`<circle ${paint} fill="${!node.fill?'none':esc(mark.color)}" cx="${number(node.x)}" cy="${number(node.y)}" r="${number(node.radius)}" />`;
  else {
    const a=mark.start*Math.PI/180,b=a+mark.fraction*Math.PI*2;
    const from=`${number(node.x+Math.cos(a)*node.radius)} ${number(node.y+Math.sin(a)*node.radius)}`;
    const to=`${number(node.x+Math.cos(b)*node.radius)} ${number(node.y+Math.sin(b)*node.radius)}`;
    const arc=`M ${from} A ${number(node.radius)} ${number(node.radius)} 0 ${mark.fraction>.5?1:0} 1 ${to}`;
    overlay=!node.fill?`<path ${paint} fill="none" d="${arc}" />`:`<path fill="${esc(mark.color)}" opacity="${number(mark.opacity)}" d="M ${number(node.x)} ${number(node.y)} L ${from} A ${number(node.radius)} ${number(node.radius)} 0 ${mark.fraction>.5?1:0} 1 ${to} Z" />`;
  }
  return `<g opacity="${number(node.opacity)}" data-omnic-role="${esc(node.id)}" data-omnic-highlighted="true" data-omnic-fraction="${number(mark.fraction)}">${base.replace(`opacity="${number(node.opacity)}"`,'opacity="1"')}${overlay}</g>`;
}
/** Self-contained output adapter shared by inline Composer and SVG image consumers.
 * All attributes need XML values: HTML boolean shorthand breaks saved-node image decoding.
 * SVG markup never becomes recipe identity. */
export function selectionFeedback(evaluation:Evaluation,selected:readonly string[]=[]){const ids=new Set(selected);return evaluation.nodes.filter(node=>ids.has(node.id)&&node.kind!=='group').map(node=>({...node,color:'#00d8ff',opacity:1,fill:false,thickness:Math.max(node.thickness,1),highlight:undefined,fillRegions:undefined}));}
export function renderSVG(evaluation:Evaluation, feedback?:{gridPitch?:number;ghost?:{x:number;y:number;radius:number;color:string};bounds?:{x:number;y:number;width:number;height:number}; selected?:readonly string[]; hovered?:readonly string[]; pivot?:{x:number;y:number}|null}):string {
  const bounds=feedback?.bounds??evaluationBounds(evaluation),selected=new Set(evaluation.selection);
  const hovered=new Set(feedback?.hovered);
  const outlines=evaluation.nodes.filter(n=>n.kind!=='group'&&hovered.has(n.componentId)).map(n=>`<circle pointer-events="none" cx="${number(n.x)}" cy="${number(n.y)}" r="${number(n.radius+1.5)}" stroke="${hovered.has(n.componentId)?'#ffe45c':'#56ffa0'}" fill="none" stroke-width="0.75"/>`).join('');
  const selectedInk=selectionFeedback(evaluation,feedback?.selected).map(node=>element(node,false)).join('');
  const grid:string[]=[];
  const pitch=feedback?.gridPitch;
  if(pitch&&Math.ceil(bounds.width/(pitch*.866))*Math.ceil(bounds.height/pitch)<1024){
    const column=pitch*Math.sqrt(3)/2;
    for(let q=Math.ceil(bounds.x/column);q<=Math.floor((bounds.x+bounds.width)/column);q++)
      for(let r=Math.ceil(-bounds.y/pitch-q/2-bounds.height/pitch);r<=Math.floor(-bounds.y/pitch-q/2);r++)
        grid.push(`<circle cx="${number(q*column)}" cy="${number(-(r+q/2)*pitch)}" r="${number(Math.min(pitch*.04,.6))}" fill="#8050b0" opacity=".5"/>`);
  }
  const ghost=feedback?.ghost?`<circle pointer-events="none" cx="${number(feedback.ghost.x)}" cy="${number(feedback.ghost.y)}" r="${number(feedback.ghost.radius)}" fill="${esc(feedback.ghost.color)}" opacity=".3"/>`:'';
  const pivot=feedback?.pivot?`<path pointer-events="none" stroke="#ffe45c" stroke-width="0.75" d="M ${number(feedback.pivot.x-3)} ${number(feedback.pivot.y)} h 6 M ${number(feedback.pivot.x)} ${number(feedback.pivot.y-3)} v 6"/>`:'';
  const attachedOwners=new Set(evaluation.nodes.filter(n=>n.regionAttachment).map(n=>n.componentId)),ownerNodes=new Map<string,StructuralNode[]>(),roots=new Map(evaluation.nodes.filter(n=>n.kind==='group').map(n=>[n.id,n]));
  for(const node of evaluation.nodes)if(node.kind!=='group'&&attachedOwners.has(node.componentId)){const members=ownerNodes.get(node.componentId)??[];members.push(node);ownerNodes.set(node.componentId,members);}
  const emitted=new Set<string>(),paint=evaluation.nodes.map(node=>{
    if(node.kind==='group')return '';
    if(!attachedOwners.has(node.componentId))return element(node,selected.has(node.id));
    if(emitted.has(node.componentId))return '';emitted.add(node.componentId);const opacity=roots.get(node.componentId)?.opacity??1;
    return `<g opacity="${number(opacity)}">${ownerNodes.get(node.componentId)!.map(part=>element({...part,opacity:opacity?part.opacity/opacity:0},selected.has(part.id))).join('')}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" data-omnic-structure="true" data-selection-environment="" data-selection-boundary="" data-selection-id="@environment" style="color-scheme:only light" width="256" height="256" preserveAspectRatio="xMidYMid meet" viewBox="${[bounds.x,bounds.y,bounds.width,bounds.height].map(number).join(" ")}" role="img" aria-label="Omnic structural composition">${grid.join("")}${paint}${selectedInk}${ghost}${outlines}${pivot}</svg>`;
}

export function svgDataUrl(svg:string){const bytes=new TextEncoder().encode(svg);let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));return `data:image/svg+xml;base64,${btoa(binary)}`;}
