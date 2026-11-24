import {dialGridCount,dialGridValue,type DialValueGrid} from '../../../properties/dialValueGrid.ts';
import {mathematicalScaleValue,type MathematicalDomain,type MathematicalScaleMode} from '../../../properties/mathematicalDial.ts';
/** The center scrubs the current arithmetic parameter through the shared value gesture. */
export function dialCenterScrub(options:{value:number;domain:MathematicalDomain;grid?:DialValueGrid;mode:MathematicalScaleMode;anchor:number;count:number;maximum?:number}){
 const {value,domain,grid,mode,anchor,count,maximum}=options;
 if(mode!=='value')return {value:count,min:0,max:maximum??0,step:1,toValue:(n:number)=>mathematicalScaleValue(anchor,n,mode)};
 if(grid)return {value:dialGridCount(grid,value),min:Math.ceil((domain.min-grid.equilibrium)/grid.snap),max:Math.floor((domain.max-grid.equilibrium)/grid.snap),step:1,toValue:(n:number)=>dialGridValue(grid,n)};
 return {value,min:domain.min,max:domain.max,step:1,toValue:(n:number)=>n};
}
