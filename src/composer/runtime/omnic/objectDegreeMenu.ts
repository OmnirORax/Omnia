import type {EditableDegree} from '../properties/editableDegrees.ts';
import type {RadialNode} from '../ui/radialMenuModel.ts';
/** Both creation and selection expose the same real controls and outward rows.
 * The first control owns the row; it remains an editable DOF, not a category. */
export function objectDegreeMenu<T>(degrees:readonly EditableDegree[],control:(degree:EditableDegree)=>{content:T;setter?:T}):RadialNode<T>[] {
 const find=(property:string)=>degrees.find(d=>d.id===property||d.properties.includes(property));
 const radius=find('omnic.radius')??find('omnic.extent');
 const right=[find('omnic.count'),find('omnic.fill'),radius,find('omnic.thickness')],left=[find('omnic.position'),find('omnic.angle')];
 const rows=([{list:right,axis:{x:1,y:0}},{list:left,axis:{x:-1,y:0}}]).flatMap(({list,axis})=>{
  const nodes=list.filter((d):d is EditableDegree=>!!d).map(original=>{const degree={...original,label:original===radius&&original.targets[0]?.input.key==='size'?'Radius':original.properties.includes('omnic.thickness')?'Line thickness':original.properties.includes('omnic.coordinate.x')?'Relocation':original.label};return {id:degree.id,label:degree.label,symbol:degree.symbol??'⊕',...control(degree)};});
  if(!nodes.length)return [];const [first,...children]=nodes;return [{...first,axis,...(children.length?{children}: {})}];
 });
 const manual=degrees.filter(d=>d.targets[0]?.input&&'editor'in d.targets[0].input&&d.targets[0].input.editor==='path-rule').map(degree=>({id:degree.id,label:degree.label,symbol:degree.symbol??'↱',axis:{x:0,y:-1},...control(degree)}));
 return [...rows,...manual];
}
