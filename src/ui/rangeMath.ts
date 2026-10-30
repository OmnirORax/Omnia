/** Quantize to a control's declared resolution without floating-point drift. */
export function rangeValue(value: number, min: number, max: number, step: number) {
  if (!Number.isFinite(value)) return min;
  const bounded = Math.max(min, Math.min(max, value));
  if (!(step > 0)) return bounded;
  return Math.max(min, Math.min(max, Number((min + Math.round((bounded - min) / step) * step).toPrecision(12))));
}

/** A rule-driven value slider traverses prepared values, not a new linear rule. */
export function rangeSequence(values:readonly number[],min:number,max:number){
 return [...new Set(values.filter(value=>Number.isFinite(value)&&value>=min&&value<=max))].sort((a,b)=>a-b);
}
export function sequenceIndex(values:readonly number[],value:number){
 if(!values.length)return -1;
 let low=0,high=values.length;
 while(low<high){const middle=(low+high)>>>1;if(values[middle]<value)low=middle+1;else high=middle;}
 if(low===0)return 0;if(low===values.length)return low-1;
 return value-values[low-1]<=values[low]-value?low-1:low;
}
export function sequenceAt(values:readonly number[],fraction:number){
 if(!values.length)return undefined;
 return values[Math.round(Math.max(0,Math.min(1,fraction))*(values.length-1))];
}
export function sequenceStep(values:readonly number[],value:number,direction:-1|1){
 if(!values.length)return undefined;
 const index=sequenceIndex(values,value),current=values[index];
 return values[Math.max(0,Math.min(values.length-1,index+(direction>0?current>value?0:1:current<value?0:-1)))];
}
