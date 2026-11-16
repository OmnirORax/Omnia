import type {EditableDegree} from '../properties/editableDegrees.ts';
import type {RadialNode} from '../ui/radialMenuModel.ts';
/** Both creation and selection expose the same real controls and outward rows.
 * Rows are presentation metadata; every control remains an independent peer. */
export function objectDegreeMenu<T>(degrees:readonly EditableDegree[],control:(degree:EditableDegree)=>{content:T;setter?:T}):RadialNode<T>[] {
 const find=(property:string)=>degrees.find(d=>d.id===property||d.properties.includes(property));
 const radius=find('omnic.radius')??find('omnic.extent');
 const right=[find('omnic.count'),find('omnic.fill'),radius,find('omnic.thickness')],left=[find('omnic.position'),find('omnic.angle')];
 const used=new Set([...right,...left].filter(Boolean));
 // Removing the Appearance category must never remove its actual freedoms.
 const remaining=degrees.filter(degree=>!used.has(degree));
 return [{id:'right',list:right,axis:{x:1,y:0}},{id:'left',list:left,axis:{x:-1,y:0}},{id:'other',list:remaining,axis:{x:0,y:-1}}].flatMap(({id,list,axis})=>
  list.filter((d):d is EditableDegree=>!!d).map(original=>{
   const degree={...original,label:original===radius&&original.targets[0]?.input.key==='size'?'Radius':original.properties.includes('omnic.thickness')?'Line thickness':original.properties.includes('omnic.coordinate.x')?'Relocation':original.label};
   return {id:degree.id,label:degree.label,symbol:degree.symbol??'⊕',row:{id,axis},...control(degree)};
  }));
}
