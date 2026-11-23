export type Signal=0|1|null;
export const GATES={IN:{pins:0},OUT:{pins:1},NOT:{pins:1},AND:{pins:2},OR:{pins:2},XOR:{pins:2},MUX:{pins:3},BUF:{pins:1}} as const;
export type Kind=keyof typeof GATES;
export type Gate={id:string;kind:Kind;inputs:(string|null)[];x:number;y:number;group:string;label:string};
export type Circuit={version:1;gates:Gate[]};
export const OPS=['ADD','SUB','AND','OR','XOR','SHL','SHR'] as const;
export type Stimulus={a:number;b:number;op:number};
export function validateCircuit(c:Circuit){
 if(!c||c.version!==1||!Array.isArray(c.gates)||c.gates.length>1024)throw Error('Circuit supports up to 1024 components.');
 const ids=new Set<string>();
 for(const g of c.gates){if(!g||typeof g.id!=='string'||!g.id||g.id.length>100||ids.has(g.id)||['__proto__','constructor','prototype'].includes(g.id)||!Object.hasOwn(GATES,g.kind)||!Array.isArray(g.inputs)||g.inputs.length!==GATES[g.kind].pins||g.inputs.some(id=>id!==null&&(typeof id!=='string'||id.length>100))||![g.x,g.y].every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)||typeof g.label!=='string'||g.label.length>100||typeof g.group!=='string'||g.group.length>50)throw Error('Invalid circuit component.');ids.add(g.id);}
 for(const g of c.gates)if(g.inputs.some(id=>id!==null&&!ids.has(id)))throw Error('A wire refers to a missing component.');
}
export function compile(c:Circuit){
 validateCircuit(c);const gates=new Map(c.gates.map(g=>[g.id,g])),waiting=new Map(c.gates.map(g=>[g.id,g.inputs.filter(id=>id!==null).length])),children=new Map<string,string[]>(),order:Gate[]=[],depth=new Map<string,number>();
 for(const g of c.gates)for(const id of g.inputs)if(id!==null){const list=children.get(id)??[];list.push(g.id);children.set(id,list);}
 const queue=c.gates.filter(g=>!waiting.get(g.id));
 for(let i=0;i<queue.length;i++){const g=queue[i];order.push(g);depth.set(g.id,Math.max(0,...g.inputs.map(id=>id===null?0:depth.get(id)??0))+(g.kind==='IN'||g.kind==='OUT'?0:1));for(const id of children.get(g.id)??[]){const left=waiting.get(id)!-1;waiting.set(id,left);if(!left)queue.push(gates.get(id)!);}}
 if(order.length!==c.gates.length)throw Error('Combinational loop: remove the feedback wire.');
 const used=new Set<string>(),stack=c.gates.filter(g=>g.kind==='OUT').map(g=>g.id);while(stack.length){const id=stack.pop()!;if(used.has(id))continue;used.add(id);for(const source of gates.get(id)!.inputs)if(source!==null)stack.push(source);}
 return {circuit:c,gates,order,delay:Math.max(0,...c.gates.filter(g=>g.kind==='OUT').map(g=>depth.get(g.id)!)),components:c.gates.filter(g=>g.kind!=='IN'&&g.kind!=='OUT').length,unused:c.gates.filter(g=>!used.has(g.id)).length,wires:c.gates.reduce((n,g)=>n+g.inputs.filter(id=>id!==null).length,0)};
}
export type Plan=ReturnType<typeof compile>;
export function inputSignal(label:string,s:Stimulus):Signal{
 if(label==='0')return 0;if(label==='1')return 1;
 const match=/^([ABO])(\d)$/.exec(label);if(!match)return null;
 const bit=Number(match[2]);if(bit>=(match[1]==='O'?3:8))return null;const value=match[1]==='A'?s.a:match[1]==='B'?s.b:s.op;return (value>>bit&1) as Signal;
}
export function logic(kind:Kind,p:Signal[]):Signal{
 const [a,b,s]=p;
 switch(kind){case 'OUT':case 'BUF':return a;case 'NOT':return a===null?null:a?0:1;case 'AND':return a===0||b===0?0:a===null||b===null?null:1;case 'OR':return a===1||b===1?1:a===null||b===null?null:0;case 'XOR':return a===null||b===null?null:(a^b) as Signal;case 'MUX':return s===null?(a===b?a:null):s?b:a;default:return null;}
}
export function evaluate(plan:Plan,stimulus:Stimulus){const values=new Map<string,Signal>();for(const g of plan.order)values.set(g.id,g.kind==='IN'?inputSignal(g.label,stimulus):logic(g.kind,g.inputs.map(id=>id===null?null:values.get(id)??null)));return values;}
/** One synchronous propagation tick; no clocks or timers run in the background. */
export function tick(plan:Plan,stimulus:Stimulus,before:Map<string,Signal>){
 const next=new Map<string,Signal>();
 const signal=(id:string|null,state:Map<string,Signal>):Signal=>{if(id===null)return null;const g=plan.gates.get(id)!;return g.kind==='IN'?inputSignal(g.label,stimulus):g.kind==='OUT'?signal(g.inputs[0],state):state.get(id)??null;};
 for(const g of plan.order)if(g.kind!=='OUT')next.set(g.id,g.kind==='IN'?inputSignal(g.label,stimulus):logic(g.kind,g.inputs.map(id=>signal(id,before))));
 for(const g of plan.order)if(g.kind==='OUT')next.set(g.id,signal(g.inputs[0],next));return next;
}
export function result(c:Circuit,values:Map<string,Signal>){const read=(label:string)=>{const out=c.gates.filter(g=>g.kind==='OUT'&&g.label===label);return out.length===1?values.get(out[0].id)??null:null;};let value=0;for(let bit=0;bit<8;bit++){const signal=read(`R${bit}`);if(signal===null)return {value:null,carry:read('C'),zero:read('Z'),negative:read('N'),overflow:read('V')};value|=signal<<bit;}return {value,carry:read('C'),zero:read('Z'),negative:read('N'),overflow:read('V')};}
export function reference({a,b,op}:Stimulus){a&=255;b&=255;const raw=op===0?a+b:op===1?a+256-b:op===2?a&b:op===3?a|b:op===4?a^b:op===5?a<<1:a>>>1,value=raw&255;return {value,carry:(op<2?raw>255:op===5?!!(a&128):op===6?!!(a&1):false)?1:0,zero:value===0?1:0,negative:value>>7,overflow:op===0?((~(a^b)&(a^value))>>7)&1:op===1?(((a^b)&(a^value))>>7)&1:0};}
