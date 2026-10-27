import type { Evaluation, StructuralNode } from "./evaluate.ts";
const esc=(text:string)=>text.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
const number=(value:number)=>String(Math.round(value*10000)/10000);
export function evaluationBounds(evaluation:Evaluation) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const node of evaluation.nodes){
    if(node.kind==="group")continue;
    const extent=node.radius+node.thickness/2;
    minX=Math.min(minX,node.x-extent,(node.x2??node.x)-node.thickness/2);minY=Math.min(minY,node.y-extent,(node.y2??node.y)-node.thickness/2);
    maxX=Math.max(maxX,node.x+extent,(node.x2??node.x)+node.thickness/2);maxY=Math.max(maxY,node.y+extent,(node.y2??node.y)+node.thickness/2);
  }
  if(!Number.isFinite(minX))return {x:-50,y:-50,width:100,height:100};
  const width=Math.max(20,maxX-minX),height=Math.max(20,maxY-minY);
  return {x:(minX+maxX-width)/2-12,y:(minY+maxY-height)/2-12,width:width+24,height:height+24};
}
function element(node:StructuralNode,selected:boolean) {
  if(node.kind==="group")return "";
  const attrs=`data-omnic-role="${esc(node.id)}" data-omnic-component="${esc(node.componentId)}" aria-label="${esc(node.id)}" stroke="${esc(node.color)}" stroke-width="${number(node.thickness)}" opacity="${number(node.opacity)}" fill="${node.fill?esc(node.color):"none"}"${selected?' data-omnic-selected="true"':''}`;
  const title=`<title>${esc(node.id)}</title>`;
  return node.kind==="line"?`<line ${attrs} x1="${number(node.x)}" y1="${number(node.y)}" x2="${number(node.x2??node.x)}" y2="${number(node.y2??node.y)}" stroke-linecap="round">${title}</line>`:`<circle ${attrs} cx="${number(node.x)}" cy="${number(node.y)}" r="${number(node.radius)}">${title}</circle>`;
}
/** Self-contained output adapter only. SVG markup never becomes recipe identity. */
export function renderSVG(evaluation:Evaluation):string {
  const bounds=evaluationBounds(evaluation),selected=new Set(evaluation.selection);
  return `<svg xmlns="http://www.w3.org/2000/svg" data-omnic-structure="true" width="256" height="256" preserveAspectRatio="xMidYMid meet" viewBox="${[bounds.x,bounds.y,bounds.width,bounds.height].map(number).join(" ")}" role="img" aria-label="Omnic structural composition">${evaluation.nodes.map(n=>element(n,selected.has(n.id))).join("")}</svg>`;
}
