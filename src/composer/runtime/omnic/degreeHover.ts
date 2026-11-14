import {createValueScrub} from '../ui/valueScrub.ts';
import type {HoverValue} from '../ui/hoverPreview.ts';
import {sameVector} from '../properties/vectorStateField.ts';
import {targetParameter,targetDegreeValue,type DegreeEditValue} from './targetDegrees.ts';
import type {Recipe} from './model.ts';
import type {EditableDegree} from '../properties/editableDegrees.ts';
/** Path is manual input: none of its targets acquire an automatic hover edit. */
export function degreeHoverAllowed(recipe:Recipe,degree:EditableDegree){
 const ids=new Set(degree.targets.map(target=>target.id));
 const walk=(items:Recipe['components'],selected=false):boolean=>items.some(item=>{const within=selected||ids.has(item.id);return within&&item.generator==='path-rule'||!!item.children&&walk(item.children,within);});
 return !walk(recipe.components)&&targetParameter(degree).editor!=='path-rule';
}
export function colorSpectrum(value:string){
 const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255),max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
 const hue=d===0?0:((max===rgb[0]?(rgb[1]-rgb[2])/d:max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4)*60+360)%360;
 const color=(h:number)=>{const x=1-Math.abs((h/60)%2-1),parts=h<60?[1,x,0]:h<120?[x,1,0]:h<180?[0,1,x]:h<240?[0,x,1]:h<300?[x,0,1]:[1,0,x];return '#'+parts.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');};
 return {hue:Math.round(hue)%360,color};
}
/** Scalar and XY freedoms use the same hover owner and acceptance lifecycle. */
export function createDegreeHover(recipe:Recipe,degree:EditableDegree,preview:(value:DegreeEditValue)=>void,commit:(value:DegreeEditValue)=>void,restore?:()=>void,accepted?:()=>void):HoverValue|undefined{
 if(!degreeHoverAllowed(recipe,degree)||!degree.axes&&degree.properties.length!==1)return;
 const parameter=targetParameter(degree);
 if(degree.axes){
  if(degree.axes.length!==2)return;
  const axes=degree.axes,before=Object.fromEntries(axes.map(axis=>[axis.properties[0],Number(targetDegreeValue(recipe,axis))]));
  let next=before,scrubs:ReturnType<typeof createValueScrub>[]=[];
  return {start(x,y=0){scrubs=axes.map((axis,index)=>{const p=targetParameter(axis);return createValueScrub({origin:{x,y},width:160,value:before[axis.properties[0]],min:p.min!,max:p.max!,step:p.step??1,axis:index?{x:0,y:-1}:{x:1,y:0}});});},move(x,y=0){const values=scrubs.map(scrub=>scrub.sample({x,y}));if(values.some(value=>value===undefined))return;const value=Object.fromEntries(axes.map((axis,i)=>[axis.properties[0],values[i]!]));if(!sameVector(next,value)){next=value;preview(value);}},commit:()=>{commit(next);accepted?.();},cancel:()=>{if(restore)restore();else preview(before);}};
 }
 const before=targetDegreeValue(recipe,degree),spectrum=parameter.kind==='color'?colorSpectrum(String(before)):undefined;
 const choices=parameter.kind==='toggle'?[false,true]:parameter.kind==='select'?parameter.options?.map(option=>option.id):undefined;
 if(parameter.kind!=='number'&&!spectrum&&!choices?.length)return;
 const initial=spectrum?.hue??(choices?Math.max(0,choices.findIndex(value=>value===before)):Number(before));
 let next:DegreeEditValue=before,scrub:ReturnType<typeof createValueScrub>;
 return {start:x=>{scrub=createValueScrub({origin:{x,y:0},width:160,value:initial,min:spectrum||choices?0:parameter.min!,max:spectrum?359:choices?choices.length-1:parameter.max!,step:spectrum||choices?1:parameter.step??1,pixelsPerStep:spectrum?1:undefined,axis:{x:1,y:0}});},move:x=>{const value=scrub.sample({x,y:0});if(value===undefined)return;const candidate=spectrum?value===initial?before:spectrum.color(value):choices?choices[value]:value;if(candidate!==next){next=candidate;preview(candidate);}},commit:()=>{commit(next);accepted?.();},cancel:()=>{if(restore)restore();else preview(before);}};
}
