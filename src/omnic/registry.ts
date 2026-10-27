/** Declarative structural inputs. Property IDs are shared-editor contracts, not
 * assumptions about the semantic meaning of a visible difference. */
export type Value = string | number | boolean;
export type Parameter = { key: string; property: string; label: string; kind: "number" | "toggle" | "select" | "color" | "text"; initial: Value; min?: number; max?: number; step?: number; options?: readonly {id:string;label:string}[]; thresholds?: readonly number[] };
export type OperatorContext = {
  params: Record<string, Value>;
  transform: (kind: "fill" | "size" | "rotate" | "oscillate", params?: Record<string, Value>) => void;
  setCount: (count: number) => void; select: () => void; connect: () => void; extract: () => void;
};
export type Definition = { id: string; label: string; parameters: readonly Parameter[]; description?: string; input?: readonly string[]; output?: "structure"|"selection"|"property"; category?: string; preconditions?: readonly string[]; apply?: (context:OperatorContext) => void };
const number = (key: string, property: string, label: string, initial: number, min: number, max: number, step = .1, thresholds?:number[]): Parameter => ({key,property,label,kind:"number",initial,min,max,step,thresholds});
const count = number("count","omnic.count","Count",6,1,64,1,[1,2,3,4,6,8,12,16,32,64]);
const radius = number("radius","omnic.radius","Radius",40,1,200,1,[10,20,40,80,160]);
const size = number("size","omnic.extent","Unit size",6,.5,100,.5,[1,2,4,8,16,32,64]);
const fill: Parameter = {key:"fill",property:"omnic.fill",label:"Fill",kind:"toggle",initial:true};
const angle = number("angle","omnic.angle","Angle",0,-1080,1080,1,[-180,-90,0,90,180,360]);
const thickness = number("thickness","omnic.thickness","Stroke width",2,.25,12,.25);
const color: Parameter = {key:"color",property:"color",label:"Color",kind:"color",initial:"#60ddec"};
const opacity = number("opacity","opacity","Opacity",1,0,1,.05);
const x = number("x","omnic.coordinate.x","Procedural X",0,-300,300,1);
const y = number("y","omnic.coordinate.y","Procedural Y",0,-300,300,1);
const paint = [fill,thickness,color,opacity] as const;
export const GENERATORS: readonly Definition[] = [
  {id:"dot",label:"Dot / disk",parameters:[size,...paint,x,y]},
  {id:"ring",label:"Ring / boundary",parameters:[radius,{...fill,initial:false},thickness,color,opacity,x,y]},
  {id:"line",label:"Continuous line",parameters:[number("length","omnic.extent","Length",80,1,300,1),angle,thickness,color,opacity,x,y]},
  {id:"chain",label:"Discrete chain",parameters:[count,size,number("spacing","omnic.spacing","Spacing",18,1,100,1),angle,...paint,x,y]},
  {id:"radial",label:"Radial array",parameters:[count,radius,size,angle,...paint,x,y]},
  {id:"group",label:"Nested group",parameters:[x,y]},
  {id:"reference",label:"Reuse object",parameters:[x,y]},
];
const operatorDefinitions: Definition[] = [
  {id:"count",label:"Set generated count",parameters:[count],preconditions:["Target a chain or radial generator"],apply:ctx=>ctx.setCount(Number(ctx.params.count))},
  {id:"size",label:"Scale structure",parameters:[number("factor","omnic.scale","Scale",1,.1,4,.1,[.25,.5,1,2,4])],apply:ctx=>ctx.transform("size")},
  {id:"fill",label:"Set fill",parameters:[fill,color,opacity],apply:ctx=>ctx.transform("fill")},
  {id:"rotate",label:"Rotate structure",parameters:[angle,number("pivotX","omnic.coordinate.x","Pivot X",0,-300,300,1),number("pivotY","omnic.coordinate.y","Pivot Y",0,-300,300,1)],apply:ctx=>ctx.transform("rotate")},
  {id:"select",label:"Select structural roles",parameters:[],output:"selection",apply:ctx=>ctx.select()},
  {id:"connect",label:"Connect selected roles",parameters:[thickness,color],preconditions:["At least two primitive roles"],apply:ctx=>ctx.connect()},
  {id:"oscillate",label:"Semantic oscillation",parameters:[number("amplitude","omnic.amplitude","Amplitude",10,0,60,1),number("frequency","omnic.frequency","Frequency (Hz)",1,.1,4,.1),number("phase","omnic.angle","Phase",0,-1080,1080,1),{key:"axis",property:"omnic.axis",label:"Axis",kind:"select",initial:"y",options:[{id:"x",label:"X"},{id:"y",label:"Y"}]}],apply:ctx=>ctx.transform("oscillate")},
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
    if (p.kind==="number" && (typeof value!=="number" || !Number.isFinite(value) || value < p.min! || value > p.max! || (p.key==="count" && !Number.isInteger(value)))) throw Error(`Unsupported range: ${spec.id}.${key}`);
    if (p.kind==="toggle" && typeof value!=="boolean") throw Error(`Expected boolean: ${key}`);
    if (p.kind==="color" && (typeof value!=="string" || !/^#[\da-f]{6}$/i.test(value))) throw Error(`Expected RGB color: ${key}`);
    if (p.kind==="select" && !p.options?.some(o=>o.id===value)) throw Error(`Unsupported choice: ${key}`);
    if (p.kind==="text" && (typeof value!=="string" || value.length>200)) throw Error(`Invalid text: ${key}`);
    params[key]=value as Value;
  }
  return params;
}
