import {linearFieldCandidate,type StateField} from './stateField.ts';
export type RegionBounds={x:number;y:number;width:number;height:number};
export type RegionAxis={field:StateField;min:number;max:number};
/** A region is an interval product in the referent's declared coordinate frame.
 * The consumer neither invents thresholds nor decides the referent's outline. */
export function regionAxisValues(axis:RegionAxis){return [...new Set(axis.field.candidates.map(c=>axis.min+c.value*(axis.max-axis.min)))].sort((a,b)=>a-b);}
export type RegionAnchor={axis:0|1;lower:boolean};
export function regionThresholdAnchor(point:{x:number;y:number}):RegionAnchor{
 const axis=Math.abs(point.x-.5)>Math.abs(point.y-.5)?0:1;
 return {axis,lower:(axis?point.y:point.x)<=.5};
}
export function regionThresholdCandidate(axes:readonly RegionAxis[],point:{x:number;y:number},anchor=regionThresholdAnchor(point)):RegionBounds|undefined{
 if(axes.length!==2||point.x<0||point.x>1||point.y<0||point.y>1)return;
 const coordinates=[point.x,point.y],index=anchor.axis,axis=axes[index];
 const candidate=linearFieldCandidate(axis.field,coordinates[index]);if(!candidate)return;
 const value=axis.min+candidate.value*(axis.max-axis.min),lower=anchor.lower;
 const low=axes.map(a=>a.min),high=axes.map(a=>a.max);
 if(lower)high[index]=value;else low[index]=value;
 if(high[0]<=low[0]||high[1]<=low[1])return;
 return {x:low[0],y:low[1],width:high[0]-low[0],height:high[1]-low[1]};
}

/** Convex clips are transformed with their rendered owner. Boundary points count
 * as ink; this is shared by picking and prepared geometry feedback. */
export function regionContains(points:readonly {x:number;y:number}[],point:{x:number;y:number}){
 if(points.length<3)return false;
 let sign=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);if(Math.abs(cross)<1e-9)continue;const next=Math.sign(cross);if(sign&&next!==sign)return false;sign=next;}
 return sign!==0;
}
