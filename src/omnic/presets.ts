import type { Recipe } from "./model.ts";
const recipe=(components:Recipe["components"],operations:Recipe["operations"]=[]):Recipe=>({version:1,revision:0,components,operations,frames:[]});
const member=recipe([{id:"units",generator:"chain",params:{count:2,size:10,spacing:28}}],[{id:"mark",operator:"highlight",targets:["units"],params:{which:"index",index:1,fraction:1,color:"#ffffff"},enabled:true}]);
const part=recipe([{id:"unit",generator:"dot",params:{size:18}}],[{id:"mark",operator:"highlight",targets:["unit"],params:{which:"all",fraction:.5,start:0,color:"#ffffff"},enabled:true}]);
export const PRESETS: readonly {id:string;label:string;symbol?:string;description:string;recipe:Recipe}[]=[
  {id:"member",label:"Member · one of two",description:"Highlight one whole unit within a generated pair.",recipe:member},
  {id:"part",label:"Part · half a unit",description:"Highlight a half-disk region without splitting its identity.",recipe:part},
  {id:"radial",label:"Radial units",description:"Six distinguishable disks in a circular arrangement.",recipe:recipe([{id:"radial",generator:"radial",params:{count:6,radius:40,size:6}}])},
  {id:"line",label:"Line",description:"A standalone continuous line.",recipe:recipe([{id:"line",generator:"line",params:{length:80}}])},
  {id:"boundary",label:"Ring",description:"A standalone circular boundary.",recipe:recipe([{id:"boundary",generator:"ring",params:{radius:60,fill:false}}])},
  {id:"nested-rings",label:"Nested rings",symbol:"◎",description:"Concentric circular boundaries with independently editable radii.",recipe:recipe([{id:"rings",generator:"group",params:{},children:[60,40,20].map((radius,index)=>({id:`ring-${index}`,generator:"ring",params:{radius,fill:false}}))}])},
  {id:"chain",label:"Discrete chain",description:"A generated linear sequence.",recipe:recipe([{id:"chain",generator:"chain",params:{count:5,size:5,spacing:20}}])},
  {id:"nested",label:"Nested composition",description:"Procedural groups with separate stable component identities.",recipe:recipe([{id:"outer",generator:"group",params:{},children:[{id:"ring",generator:"ring",params:{radius:60}},{id:"inner",generator:"radial",params:{count:4,radius:25,size:8}}]}])},
];
export function createRecipe(preset="radial"):Recipe {return structuredClone((PRESETS.find(p=>p.id===preset)??PRESETS.find(p=>p.id==="radial")!).recipe);}
