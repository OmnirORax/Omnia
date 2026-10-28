import type { Parameter, Value } from './registry.ts';
const numeric = (key:string, property:string, label:string, initial:number, min:number, max:number, step=1):Parameter => ({key,property,label,initial,min,max,step,kind:'number'});
export const ATOMNIC_PARAMETERS: readonly Parameter[] = [
  {key:'active',property:'atomnic.active',label:'Atomnic mode',kind:'toggle',initial:false},
  {key:'mode',property:'atomnic.mode',label:'Constraints',kind:'select',initial:'constrained',options:[{id:'free',label:'Free'},{id:'constrained',label:'Touching lattice'}]},
  {key:'scope',property:'atomnic.scope',label:'Scope',kind:'select',initial:'micro',options:[{id:'micro',label:'Micro · members'},{id:'macro',label:'Macro · groups'}]},
  {key:'paint',property:'atomnic.paintTarget',label:'Paint target',kind:'select',initial:'brush',options:[{id:'brush',label:'Brush / next mark'},{id:'selection',label:'Selected units'}]},
  numeric('size','omnic.extent','Imprint radius',10,.5,50,.5),
  numeric('step','atomnic.step','Movement step',20,.0001,100,.0001),
  numeric('thickness','omnic.thickness','Stroke width',.25,.25,12,.25),
  numeric('order','halving.angularOrder','Angular halving order',0,0,6),
  numeric('steps','halving.turnSteps','Rotation steps',1,-96,96),
  {key:'pivotMode',property:'atomnic.pivotMode',label:'Pivot picking',kind:'select',initial:'target',options:[{id:'exact',label:'Exact click'},{id:'target',label:'Detected target'}]},
  numeric('axis','halving.axisStep','Reference axis step',0,0,383),
  numeric('position','atomnic.pivotFraction','Position along axis',.5,0,1,.0001),
  numeric('viewSize','atomnic.viewSize','Construction view extent',200,40,1000),
  numeric('fraction','omnic.regionFraction','Highlighted fraction',.5,0,1,.0001),
  numeric('markTurn','angle.turn','Mark orientation · turns',0,-3,3,.0001),
  {key:'fill',property:'omnic.fill',label:'Filled',kind:'toggle',initial:true},
  {key:'color',property:'color',label:'Color',kind:'color',initial:'#ffffff'},
  numeric('opacity','opacity','Opacity',1,0,1,.01),
];
export const atomnicDefaults = ():Record<string,Value> => Object.fromEntries(ATOMNIC_PARAMETERS.map(p=>[p.key,p.initial]));

/** Retained construction viewport also defines saved Atomnic presentation scale. */
export function atomnicViewBounds(params?:Record<string,Value>) {
  if(!params)return undefined;
  const size=Number(params.viewSize??200);
  return {x:-size/2,y:-size/2,width:size,height:size};
}

/** Each action declares its applicable input sequence, never a second value store. */
export const ATOMNIC_OPERATION_INPUTS = {
  'atomnic.erase':['scope'],
  'atomnic.draw':['mode','paint','size','step','thickness','fill','color','opacity'],
  'atomnic.select':['scope'],
  'atomnic.move':['scope','mode','step'],
  'atomnic.rotate':['scope','order','steps'],
  'atomnic.step':['scope','order','steps'],
  'atomnic.highlight':['scope','fraction','markTurn','color','opacity'],
  'atomnic.fill':['scope','fill','color','opacity'],
  'atomnic.group':['scope'],
  'atomnic.remove':['scope'],
  'atomnic.configure':['viewSize'],
} as const;
export type AtomnicConfigAction=keyof typeof ATOMNIC_OPERATION_INPUTS;
