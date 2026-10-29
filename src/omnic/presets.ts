import type { Recipe } from "./model.ts";
const recipe=(components:Recipe["components"],operations:Recipe["operations"]=[]):Recipe=>({version:1,revision:0,components,operations,frames:[]});
export const PRESETS: readonly {id:string;label:string;symbol?:string;description:string;recipe:Recipe}[]=[
  {id:"count-grid",label:"Mathematical count",symbol:"⬤",description:"Count dial experiment; rows of twenty dots grow upward.",recipe:recipe([{id:"count-grid",generator:"count-grid",params:{count:1,size:4,color:"#ffffff"}}])},
  {id:"radial",label:"Radial units",description:"Six distinguishable disks in a circular arrangement.",recipe:recipe([{id:"radial",generator:"radial",params:{count:6,radius:40,size:6}}])},
  {id:"line",label:"Line",description:"A standalone continuous line.",recipe:recipe([{id:"line",generator:"line",params:{length:80}}])},
  {id:"boundary",label:"Ring",description:"A standalone circular boundary.",recipe:recipe([{id:"boundary",generator:"ring",params:{radius:60,fill:false}}])},
  {id:"nested-rings",label:"Nested rings",symbol:"◎",description:"Count-controlled rings with radial and visual progression.",recipe:recipe([{id:"rings",generator:"rings",params:{count:3,radius:20,spacing:20,fill:false}}])},
  {id:"chain",label:"Discrete chain",description:"A generated linear sequence.",recipe:recipe([{id:"chain",generator:"chain",params:{count:5,size:5,spacing:20}}])},
  {id:"nested",label:"Nested composition",description:"Procedural groups with separate stable component identities.",recipe:recipe([{id:"outer",generator:"group",params:{},children:[{id:"ring",generator:"ring",params:{radius:60}},{id:"inner",generator:"radial",params:{count:4,radius:25,size:8}}]}])},
];
export function createRecipe(preset="radial"):Recipe {return structuredClone((PRESETS.find(p=>p.id===preset)??PRESETS.find(p=>p.id==="radial")!).recipe);}
