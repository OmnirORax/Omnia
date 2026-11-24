import {dialGridCount,dialGridValue,type DialValueGrid} from '../../../properties/dialValueGrid.ts';
import {mathematicalScaleValue,type MathematicalDomain,type MathematicalScaleMode,type MathematicalMarks,type MathematicalSlotMode} from '../../../properties/mathematicalDial.ts';
/** Scrub the active arithmetic parameter in whole contributions of its numeral base. */
export function dialCenterScrub(options:{value:number;domain:MathematicalDomain;grid?:DialValueGrid;mode:MathematicalScaleMode;anchor:number;count:number;maximum?:number;base?:1|2}){
 const {value,domain,grid,mode,anchor,count,maximum,base=1}=options,numeral=(n:number)=>n*base;
 if(mode!=='value')return {value:count/base,min:0,max:Math.floor((maximum??0)/base),step:1,numeral,toValue:(n:number)=>mathematicalScaleValue(anchor,numeral(n),mode)};
 if(grid)return {value:dialGridCount(grid,value)/base,min:Math.ceil((domain.min-grid.equilibrium)/grid.snap/base),max:Math.floor((domain.max-grid.equilibrium)/grid.snap/base),step:1,numeral,toValue:(n:number)=>dialGridValue(grid,numeral(n))};
 return {value:value/base,min:Math.ceil(domain.min/base),max:Math.floor(domain.max/base),step:1,numeral,toValue:numeral};
}
/** Use existing visible/next-ring slots; preview never allocates unbounded rings. */
export function dialCenterMarks(n:number,base:1|2,rings:readonly {order:number;count:number}[]):MathematicalMarks|undefined{
 let remaining=Math.abs(n)/base;if(!Number.isSafeInteger(remaining))return;
 const selected:string[]=[];
 for(const ring of rings)if(remaining>0&&remaining<=ring.count)return {selected:[`${ring.order}:${remaining-1}`],modes:{}};
 for(const ring of rings)for(let ordinal=ring.count;ordinal>=1&&remaining>0;ordinal--)if(ordinal<=remaining){selected.push(`${ring.order}:${ordinal-1}`);remaining-=ordinal;}
 if(remaining===0)return {selected,modes:{}};
 // Powers of two keep large two-dot numerals within the rendered slot budget.
 if(base===2){
  let value=Math.abs(n);const encoded:{selected:string[];modes:Record<string,MathematicalSlotMode>}={selected:[],modes:{}};
  for(let power=1;value>0&&power<=52;power++){
   const contribution=2**power;if(value% (contribution*2)<contribution)continue;
   const index=power===1?0:power-2,ring=rings.find(r=>index<r.count&&!encoded.selected.includes(`${r.order}:${index}`));if(!ring)return;
   const key=`${ring.order}:${index}`;encoded.selected.push(key);if(power>1)encoded.modes[key]='recursion';value-=contribution;
  }
  if(value===0)return encoded;
 }
 return undefined;
}
