import { RELATION_FREEDOM_GROUP, UNIT_FREEDOM_GROUP, POSITION_FREEDOM_GROUP, VISUAL_FREEDOM_GROUP, type FreedomPresentation } from "../properties/editableDegrees.ts";
import { rotationStops } from "./rotation.ts";
/** Declarative structural inputs. Property IDs are shared-editor contracts, not
 * assumptions about the semantic meaning of a visible difference. */
export type Value = string | number | boolean;
export type Parameter = { unit?:string; picker?:"mathematical"; freedom?:FreedomPresentation; key: string; property: string; label: string; kind: "number" | "toggle" | "select" | "color" | "text"; initial: Value; min?: number; max?: number; step?: number; options?: readonly {id:string;label:string}[]; thresholds?: readonly number[]; when?: (params:Record<string,Value>)=>boolean };
export type OperatorContext = {
  params: Record<string, Value>;
  transform: (kind: "fill" | "size" | "rotate" | "oscillate", params?: Record<string, Value>) => void;
  highlight: () => void; setCount: (count: number) => void; select: () => void; connect: () => void; extract: () => void;
};
export type Definition = { id: string; label: string; symbol?: string; parameters: readonly Parameter[]; description?: string; input?: readonly string[]; output?: "structure"|"selection"|"property"; category?: string; preconditions?: readonly string[]; apply?: (context:OperatorContext) => void };
const number = (key: string, property: string, label: string, initial: number, min: number, max: number, step = .1, thresholds?:number[]): Parameter => ({key,property,label,kind:"number",initial,min,max,step,thresholds});
const count:Parameter = {...number("count","omnic.count","Count",6,1,64,1,[1,2,3,4,6,8,12,16,32,64]),freedom:{label:"Count",symbol:"●●",group:[UNIT_FREEDOM_GROUP]}};
const radius:Parameter = {...number("radius","omnic.radius","Radius",40,1,200,1,[10,20,40,80,160]),unit:'length',freedom:{label:"Radius",symbol:"⊖",group:[RELATION_FREEDOM_GROUP]}};
const size:Parameter = {...number("size","omnic.extent","Unit size",6,.5,100,.5,[1,2,4,8,16,32,64]),unit:'length',freedom:{label:'Size',symbol:'●⬤',group:[UNIT_FREEDOM_GROUP]}};
const fill: Parameter = {key:"fill",property:"omnic.fill",label:"Fill",kind:"toggle",initial:true,freedom:{label:"Fill",symbol:"◐",group:[UNIT_FREEDOM_GROUP]}};
const angle:Parameter = {...number("angle","omnic.angle","Angle",0,-1080,1080,1,[-180,-90,0,90,180,360]),freedom:{label:"Rotation",symbol:"🗘",group:[POSITION_FREEDOM_GROUP]}};
const thickness:Parameter = {...number("thickness","omnic.thickness","Stroke width",2,.25,12,.25),unit:'length',freedom:{label:"Stroke width",symbol:"━",group:[UNIT_FREEDOM_GROUP]}};
const color: Parameter = {key:"color",property:"color",label:"Color",kind:"color",initial:"#60ddec",freedom:{label:"Color",symbol:"⬤",group:[VISUAL_FREEDOM_GROUP],symbolFill:"conic-gradient(#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)"}};
const opacity:Parameter = {...number("opacity","opacity","Opacity",1,0,1,.05),freedom:{label:"Opacity",symbol:"⬤",symbolOpacity:.5,group:[VISUAL_FREEDOM_GROUP]}};
const x:Parameter = {...number("x","omnic.coordinate.x","Position X",0,-300,300,1),freedom:{label:"Position X",symbol:"⊕X",group:[POSITION_FREEDOM_GROUP]}};
const y:Parameter = {...number("y","omnic.coordinate.y","Position Y",0,-300,300,1),freedom:{label:"Position Y",symbol:"⊕Y",group:[POSITION_FREEDOM_GROUP]}};
const paint = [fill,thickness,color,opacity] as const;
export const GENERATORS: readonly Definition[] = [
  {id:"count-grid",label:"Count grid",symbol:"⬤",parameters:[{...count,initial:1,picker:"mathematical"},size,...paint,x,y]},
  {id:"dot",label:"Dot / disk",symbol:"●",parameters:[size,angle,...paint,x,y]},
  {id:"ring",label:"Ring / boundary",symbol:"○",parameters:[radius,{...fill,initial:false},thickness,color,opacity,x,y]},
  {id:"rings",label:"Nested rings",symbol:"◎",parameters:[count,{...radius,label:"Innermost radius",initial:20},
    {...number("spacing","omnic.spacing","Radial gap",20,0,100,.5),unit:"length",freedom:{label:"Radial gap",symbol:"↔",group:[POSITION_FREEDOM_GROUP]}},
    {...number("growth","omnic.ringGrowth","Gap progression",1,.25,2,.05,[.5,1,2]),freedom:{label:"Gap progression",symbol:"↔",group:[POSITION_FREEDOM_GROUP]}},
    {...number("drift","omnic.ringDrift","Centre offset per ring",0,0,100,.5),unit:"length",freedom:{label:"Centre offset",symbol:"⟊",group:[POSITION_FREEDOM_GROUP]}},angle,
    {...fill,initial:false},thickness,color,opacity,
    {...number("thicknessGrowth","omnic.strokeProgression","Stroke progression",1,.25,2,.05),freedom:{label:"Stroke progression",symbol:"≋",group:[UNIT_FREEDOM_GROUP]}},
    {...number("opacityGrowth","omnic.opacityProgression","Opacity progression",1,0,1,.05),freedom:{label:"Opacity progression",symbol:"◍",group:[VISUAL_FREEDOM_GROUP]}},x,y]},
  {id:"line",label:"Continuous line",symbol:"━",parameters:[{...number("length","omnic.extent","Length",80,1,300,1),unit:"length",freedom:{label:"Length",symbol:"↔",group:[UNIT_FREEDOM_GROUP]}},angle,thickness,color,opacity,x,y]},
  {id:"chain",label:"Discrete chain",symbol:"⠒",parameters:[count,size,{...number("spacing","omnic.spacing","Spacing",18,1,100,1),unit:"length",freedom:{label:"Spacing",symbol:"↔",group:[POSITION_FREEDOM_GROUP]}},angle,...paint,x,y]},
  {id:"radial",label:"Radial array",symbol:"❉",parameters:[count,radius,size,angle,...paint,x,y]},
  {id:"group",label:"Nested group",symbol:"⠿",parameters:[x,y]},
  {id:"reference",label:"Reuse object",symbol:"♻",parameters:[x,y]},
];
const select = (key:string, property:string, label:string, initial:string, options:readonly {id:string;label:string}[]):Parameter => ({key,property,label,initial,options,kind:"select"});
const operatorDefinitions: Definition[] = [
  {id:"highlight",label:"Highlight units / region",parameters:[
    select("which","omnic.unitSelection","Units","index",[{id:"index",label:"One unit"},{id:"all",label:"All scoped units"}]),
    {...number("index","omnic.unitIndex","Unit (1-based)",1,1,1024,1),when:p=>p.which==="index"},
    number("fraction","omnic.regionFraction","Highlighted fraction",1,0,1,.05,[.25,.5,1]),
    {...number("start","omnic.regionAngle","Region start (°)",0,-1080,1080,1),when:p=>Number(p.fraction)>0&&Number(p.fraction)<1},
    {...color,initial:"#ffffff"},opacity],output:"structure",apply:ctx=>ctx.highlight()},
  {id:"count",label:"Set generated count",parameters:[count],preconditions:["Target a count-based generator"],apply:ctx=>ctx.setCount(Number(ctx.params.count))},
  {id:"size",label:"Scale structure",parameters:[number("factor","omnic.scale","Scale",1,.1,4,.1,[.25,.5,1,2,4])],apply:ctx=>ctx.transform("size")},
  {id:"fill",label:"Set fill",parameters:[fill,color,opacity],apply:ctx=>ctx.transform("fill")},
  {id:"rotate",label:"Rotate structure",parameters:[angle,{...number("pivotX","omnic.coordinate.x","Pivot X",0,-300,300,1),when:p=>p.scope==="group"&&p.pivot==="custom"},{...number("pivotY","omnic.coordinate.y","Pivot Y",0,-300,300,1),when:p=>p.scope==="group"&&p.pivot==="custom"},
    select("scope","omnic.rotationScope","Rotate","group",[{id:"region",label:"Highlighted region"},{id:"each",label:"Each unit"},{id:"group",label:"Together"}]),
    {...select("pivot","omnic.rotationPivot","Pivot","origin",[{id:"center",label:"Target center"},{id:"origin",label:"Composition origin"},{id:"custom",label:"Custom offset"}]),when:p=>p.scope==="group"},
    number("snap","omnic.rotationSnap","Snap step (°; 0 = free)",0,0,360,.5,[0,15,30,45,60,90]),
    {...number("snapOrigin","omnic.rotationSnapOrigin","Snap origin (°)",0,-360,360,1),when:p=>Number(p.snap)>0&&!String(p.stops).trim()},
    {key:"stops",property:"omnic.rotationStops",label:"Allowed angles (comma-separated)",kind:"text",initial:""}
    ],apply:ctx=>ctx.transform("rotate")},
  {id:"select",label:"Select structural roles",parameters:[],output:"selection",apply:ctx=>ctx.select()},
  {id:"connect",label:"Connect selected roles",parameters:[thickness,color],preconditions:["At least two primitive roles"],apply:ctx=>ctx.connect()},
  {id:"oscillate",label:"Oscillation",symbol:"≈",category:"mfx",parameters:[number("amplitude","omnic.amplitude","Amplitude",10,0,60,1),number("frequency","omnic.frequency","Frequency (Hz)",1,.1,4,.1),number("phase","omnic.angle","Phase",0,-1080,1080,1),{key:"axis",property:"omnic.axis",label:"Axis",kind:"select",initial:"y",options:[{id:"x",label:"X"},{id:"y",label:"Y"}]}],apply:ctx=>ctx.transform("oscillate")},
  {id:"inspect",label:"Extract unit count",parameters:[],output:"property",apply:ctx=>ctx.extract()},
];
for (const item of operatorDefinitions) {
  item.input ??= ["structure", "selection"]; item.output ??= "structure";
  item.category ??= item.output === "structure" ? "Transformation" : "Interpretation";
}
export const OPERATORS: readonly Definition[] = operatorDefinitions;
/** Trusted code extension point; imported recipes only refer to registered IDs. */
export function registerOperator(item:Definition):()=>void {
  if(!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(item.id)||operatorDefinitions.some(d=>d.id===item.id)||typeof item.apply!=="function")throw Error("Invalid/duplicate operator registration.");
  const entry={input:["structure"],output:"structure" as const,category:"Transformation",...item};operatorDefinitions.push(entry);
  return ()=>{const index=operatorDefinitions.indexOf(entry);if(index>=0)operatorDefinitions.splice(index,1);};
}
export function definition(id: string, generator = false) { return (generator ? GENERATORS : OPERATORS).find(item => item.id === id); }
export function defaultParams(spec: Definition): Record<string, Value> { return Object.fromEntries(spec.parameters.map(p=>[p.key,p.initial])); }
export function checkedParams(input: unknown, spec: Definition): Record<string,Value> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error(`Invalid parameters: ${spec.id}`);
  const params:Record<string,Value> = {};
  for (const [key,value] of Object.entries(input)) {
    const p=spec.parameters.find(p=>p.key===key); if(!p) throw Error(`Unknown parameter ${spec.id}.${key}`);
    if (p.kind==="number" && (typeof value!=="number" || !Number.isFinite(value) || value < p.min! || value > p.max! || ((["count","index"].includes(p.key) || spec.id === "atomnic" && ["order","steps","axis"].includes(p.key)) && !Number.isInteger(value)))) throw Error(`Unsupported range: ${spec.id}.${key}`);
    if (p.kind==="toggle" && typeof value!=="boolean") throw Error(`Expected boolean: ${key}`);
    if (p.kind==="color" && (typeof value!=="string" || !/^#[\da-f]{6}$/i.test(value))) throw Error(`Expected RGB color: ${key}`);
    if (p.kind==="select" && !p.options?.some(o=>o.id===value)) throw Error(`Unsupported choice: ${key}`);
    if (p.kind==="text" && (typeof value!=="string" || value.length>200)) throw Error(`Invalid text: ${key}`);
    if (spec.id === "rotate" && key === "stops") rotationStops(String(value));
    params[key]=value as Value;
  }
  return params;
}

/** Active editors and MC lend the same metadata-defined relevant inputs. */
export function applicableParameters(spec:Definition,params:Record<string,Value>):readonly Parameter[]{
  const values={...defaultParams(spec),...params};
  return spec.parameters.filter(parameter=>!parameter.when||parameter.when(values));
}
