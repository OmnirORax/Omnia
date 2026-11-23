import {type Circuit,type Gate,type Kind} from './circuit.ts';
/** Textbook ripple-carry architecture; not a claim about market popularity. */
export function starterCircuit():Circuit{
 const gates:Gate[]=[],rows=new Map<string,number>();
 const gate=(id:string,kind:Kind,inputs:(string|null)[],group:string,label=id,x?:number)=>{const row=rows.get(group)??0;rows.set(group,row+1);gates.push({id,kind,inputs,group,label,x:x??row%8*135,y:group==='Control'?-600+Math.floor(row/8)*65:Number(group.slice(4))*340+Math.floor(row/8)*65});return id;};
 const zero=gate('zero','IN',[],'Control','0'),ones=Array.from({length:3},(_,i)=>gate(`op${i}`,'IN',[],'Control',`O${i}`)),not=ones.map((id,i)=>gate(`nop${i}`,'NOT',[id],'Control'));
 const decode=Array.from({length:7},(_,op)=>{const a=gate(`decode${op}a`,'AND',[op&1?ones[0]:not[0],op&2?ones[1]:not[1]],'Control');return gate(`decode${op}`,'AND',[a,op&4?ones[2]:not[2]],'Control');});
 const sub=decode[1],arithmetic=gate('arithmetic','OR',[decode[0],decode[1]],'Control');
 const a=Array.from({length:8},(_,i)=>gate(`a${i}`,'IN',[],`Bit ${i}`,`A${i}`)),b=Array.from({length:8},(_,i)=>gate(`b${i}`,'IN',[],`Bit ${i}`,`B${i}`)),carries=[sub],out:string[]=[];
 for(let i=0;i<8;i++){
  const group=`Bit ${i}`,n=(suffix:string,kind:Kind,inputs:(string|null)[])=>gate(`b${i}_${suffix}`,kind,inputs,group,suffix);
  const bx=n('B xor SUB','XOR',[b[i],sub]),p=n('propagate','XOR',[a[i],bx]),sum=n('sum','XOR',[p,carries[i]]),generate=n('generate','AND',[a[i],bx]),carry=n('carry term','AND',[p,carries[i]]);carries.push(n('carry','OR',[generate,carry]));
  const choices=[sum,sum,n('AND','AND',[a[i],b[i]]),n('OR','OR',[a[i],b[i]]),n('XOR','XOR',[a[i],b[i]]),i?a[i-1]:zero,i===7?zero:a[i+1]];
  let value=zero;for(let op=0;op<7;op++)value=n(`select ${op}`,'MUX',[value,choices[op],decode[op]]);
  out.push(gate(`r${i}`,'OUT',[value],group,`R${i}`));
 }
 let any=out[0];for(let i=1;i<8;i++)any=gate(`any${i}`,'OR',[any,out[i]],'Control');
 const z=gate('zero flag','NOT',[any],'Control'),v=gate('overflow','XOR',[carries[7],carries[8]],'Control'),ov=gate('arithmetic overflow','AND',[arithmetic,v],'Control');
 const ac=gate('arithmetic carry','AND',[arithmetic,carries[8]],'Control'),lc=gate('left carry','MUX',[ac,a[7],decode[5]],'Control'),rc=gate('right carry','MUX',[lc,a[0],decode[6]],'Control');
 for(const [label,id]of [['Z',z],['N',out[7]],['V',ov],['C',rc]])gate(`flag${label}`,'OUT',[id],'Control',label);
 return {version:1,gates};
}
