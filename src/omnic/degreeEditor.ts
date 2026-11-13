import {field} from '../ui/fields.ts';
import {liveForm} from '../ui/liveForm.ts';
import type {EditableDegree} from '../properties/editableDegrees.ts';
import {maximumSelectionStates} from '../properties/stateSelection.ts';
import {DEFAULT_REFERENCE_SETTINGS,resolveReferenceUse,createReferenceField,type ReferenceSettings} from '../properties/referenceUse.ts';
import type {StateFieldConfiguration} from '../properties/stateField.ts';
import {stateFieldDomain} from './stateFieldAdapter.ts';
import {operationGeometry,matchForOperation,resolveMatch} from './operationContext.ts';
import {measuredReferenceFor} from './referenceMeasures.ts';
import {targetParameter,targetDegreeValue,writeTargetDegree,type DegreeEditValue} from './targetDegrees.ts';
import {evaluateRecipe} from './evaluate.ts';
import type {Recipe,RecipeResolver} from './model.ts';
type Host={read:()=>Recipe;write:(recipe:Recipe,group?:string)=>void;resolve:()=>RecipeResolver;pick:(accept:(id:string)=>void)=>void;path:(value:string,write:(value:string)=>void)=>void;bounds:()=>{x:number;y:number;width:number;height:number};error:(message:string)=>void};
export function degreeEditor(body:HTMLElement,degree:EditableDegree,host:Host){
 body.replaceChildren();const root=document.createElement('form');body.append(root);
 const button=(label:string,run:()=>void,parent:HTMLElement=root)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{try{run();}catch(e){host.error(String(e));}};parent.append(b);return b;};
 const fields=(degree.axes??[degree]).map(axis=>{const parameter=targetParameter(axis),entry=field({key:axis.id,label:parameter.label,kind:parameter.kind,min:parameter.min,max:parameter.max,step:parameter.step,options:parameter.options},targetDegreeValue(host.read(),axis));root.append(entry.row);
  if(parameter.editor==='path-rule')button('Path',()=>host.path(String(targetDegreeValue(host.read(),axis)),value=>host.write(writeTargetDegree(host.read(),axis,value))),entry.row);
  if(parameter.kind==='number')button('States',()=>states(axis),entry.row);return {axis,entry};});
 liveForm(root,group=>{try{const value:DegreeEditValue=degree.axes?Object.fromEntries(fields.map(({axis,entry})=>[axis.properties[0],Number(entry.value())])):fields[0].entry.value();host.write(writeTargetDegree(host.read(),degree,value),group);}catch(e){host.error(String(e));}});
 function states(axis:EditableDegree){
  const parameter=targetParameter(axis),domain=stateFieldDomain(parameter);if(!domain)return;
  body.replaceChildren();const controls=document.createElement('form'),stage=document.createElement('div'),settings=document.createElement('form');body.append(controls,stage,settings);
  let source:string|undefined,referenceSettings:ReferenceSettings={...DEFAULT_REFERENCE_SETTINGS},config:StateFieldConfiguration={mode:'symmetry',count:6,step:parameter.step??1,reference:Number(targetDegreeValue(host.read(),axis))};
  const commit=(value:number)=>{host.write(writeTargetDegree(host.read(),axis,value),'omnic-state-field');};
  const mode=field({key:'mode',label:'Mode',kind:'select',options:['symmetry','halving','step'].map(id=>({id,label:id}))},config.mode),count=field({key:'count',label:'Count',kind:'number',min:1,max:64,step:1},config.count),step=field({key:'step',label:'Step',kind:'number'},config.step),minimum=field({key:'min',label:'Min',kind:'number'},domain.min),maximum=field({key:'max',label:'Max',kind:'number'},domain.max);controls.append(mode.row,count.row,step.row,minimum.row,maximum.row);
  const use=field({key:'use',label:'Reference',kind:'select',options:['bounds','step','match'].map(id=>({id,label:id}))},referenceSettings.use),measure=field({key:'measure',label:'Measure',kind:'select',options:[{id:'context',label:'Context'}]},'context'),numerator=field({key:'numerator',label:'×',kind:'number',min:0.000001},1),denominator=field({key:'denominator',label:'÷',kind:'number',min:0.000001},1);settings.append(use.row,measure.row,numerator.row,denominator.row);
  button('Match',()=>host.pick(id=>{const recipe=host.read(),resolve=host.resolve(),snapshot=operationGeometry(recipe,evaluateRecipe(recipe,resolve)),candidate=matchForOperation(snapshot,[...new Set(axis.targets.map(t=>t.id))],axis.id,id,resolve);if(!candidate)throw Error('No compatible match.');host.write(writeTargetDegree(recipe,axis,resolveMatch(recipe,candidate,resolve).value));draw();}),controls);button('Self',()=>{source=undefined;draw();},controls);button('Environment',()=>{source='@environment';draw();},controls);button('Pick',()=>host.pick(id=>{source=id;draw();}),controls);button('Back',()=>degreeEditor(body,degree,host),controls);
  function draw(){
   const recipe=host.read(),snapshot=operationGeometry(recipe,evaluateRecipe(recipe,host.resolve())),reference=measuredReferenceFor(snapshot,axis,source,host.bounds());
   if(source&&!reference){stage.textContent='Incompatible reference';return;}
   if(measure.input instanceof HTMLSelectElement){const selected=measure.input.value;measure.input.replaceChildren();for(const entry of [{id:'context',label:'Context'},...(reference?.measures??[])]){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.label;measure.input.append(option);}measure.input.value=[...measure.input.options].some(option=>option.value===selected)?selected:'context';}
   referenceSettings={use:use.value() as ReferenceSettings['use'],measure:String(measure.value()),numerator:Number(numerator.value()),denominator:Number(denominator.value())};
   const resolved=reference&&resolveReferenceUse(reference,referenceSettings,Number(targetDegreeValue(recipe,axis))),field=createReferenceField(domain!,config,resolved,value=>{try{writeTargetDegree(recipe,axis,value);return true;}catch{return false;}});stage.replaceChildren();
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','-1 -1 2 2');svg.classList.add('omnic-state-field');stage.append(svg);
   for(const candidate of field.candidates){const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',String(candidate.point.x));circle.setAttribute('cy',String(candidate.point.y));circle.setAttribute('r','.06');circle.setAttribute('fill',Math.abs(candidate.value-Number(targetDegreeValue(recipe,axis)))<1e-8?'#00d8ff':'#ffffff');circle.setAttribute('tabindex','0');circle.setAttribute('aria-label',String(candidate.value));circle.addEventListener('click',()=>{try{commit(candidate.value);draw();}catch(e){host.error(String(e));}});circle.addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Enter')circle.dispatchEvent(new MouseEvent('click'));});svg.append(circle);}
   const values=document.createElement('div');values.className='omnic-state-values';for(const candidate of field.candidates)button(String(Number(candidate.value.toPrecision(6))),()=>{commit(candidate.value);draw();},values);stage.append(values);
  }
  const update=()=>{try{config={...config,mode:mode.value() as StateFieldConfiguration['mode'],count:Math.min(Number(count.value()),maximumSelectionStates(mode.value() as StateFieldConfiguration['mode'])),step:Number(step.value()),min:Number(minimum.value()),max:Number(maximum.value())};count.input.value=String(config.count);draw();}catch(e){host.error(String(e));}};liveForm(controls,update);liveForm(settings,update);draw();
 }
}
