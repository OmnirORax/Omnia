import type {EditableDegree} from '../properties/editableDegrees.ts';
/** Stable positions around the subject. Extra existing controls remain available
 * on the upper/lower rows without reintroducing category buttons. */
export function objectDialSlots(degrees:readonly EditableDegree[],extraIds:readonly string[]=[]){
 const slots:Record<string,{x:number;y:number}>={},used=new Set<string>();
 const put=(properties:readonly string[],x:number,y:number)=>{const degree=degrees.find(d=>!used.has(d.id)&&properties.some(p=>d.id===p||d.properties.includes(p)));if(degree){used.add(degree.id);slots[degree.id]={x,y};}};
 put(['omnic.count'],36,0);put(['omnic.fill'],72,0);put(['omnic.radius','omnic.extent'],108,0);put(['omnic.thickness'],144,0);
 put(['omnic.position'], -36,0);put(['omnic.angle'], -72,0);
 const rest=[...extraIds,...degrees.filter(d=>!used.has(d.id)).map(d=>d.id)];
 rest.forEach((id,i)=>{const row=Math.floor(i/9)+1,col=i%9;slots[id]={x:(col-4)*36,y:(row%2?-1:1)*Math.ceil(row/2)*72};});
 return slots;
}

export function objectDegreeLabel(degree:EditableDegree){if(degree.properties.includes('omnic.extent')&&degree.targets[0]?.input.key==='size')return 'Radius';if(degree.properties.includes('omnic.thickness'))return 'Line thickness';return degree.label;}
export function objectDegreeSymbol(degree:EditableDegree){return degree.properties.includes('omnic.extent')&&degree.targets[0]?.input.key==='size'?'⊖':degree.symbol;}
