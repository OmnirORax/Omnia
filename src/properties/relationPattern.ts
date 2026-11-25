import {RELATION_LAGS,addRelationRow,relationCounts,relationProfile,relationError,relationPair,type RelationProfile} from './colorRelations.ts';
const layouts=new Map<string,number[]>();
/** Bounded quota-preserving search, cached independently of paint and display scale. */
export function relationPattern(ratio:readonly number[],target:RelationProfile,inverse:boolean,seed:(counts:readonly number[],growing:boolean)=>number[],budget:number){
 const key=JSON.stringify([ratio,target,inverse,budget]);const cached=layouts.get(key);if(cached)return cached;
 const remember=(row:number[])=>{layouts.set(key,row);if(layouts.size>16)layouts.delete(layouts.keys().next().value!);return row;};
 const base=ratio.reduce((a,b)=>a+b,0),repeat=Math.max(1,Math.min(Math.floor(budget/base),Math.ceil(64/base))),counts=ratio.map(n=>n*repeat),length=base*repeat;
 const score=(row:readonly number[])=>{const stats=relationCounts(counts.length);addRelationRow(stats,row);return relationError(relationProfile(stats),target,inverse);};
 let best=seed(counts,false),error=score(best);
 const consider=(row:number[])=>{const next=score(row);if(next<error-1e-9){best=row;error=next;}};
 if(!inverse&&error===0)return remember(best);
 consider(seed(counts,true));
 const order=[0];while(order.length<counts.length){const last=order.at(-1)!,remaining=counts.map((_,i)=>i).filter(i=>!order.includes(i));remaining.sort((a,b)=>(target.pairs[relationPair(last,b)]??0)-(target.pairs[relationPair(last,a)]??0)||a-b);order.push(remaining[0]);}
 // Seeds span dense interleaving through broad clusters; pair deficits choose neighbors.
 const chance=counts.reduce((n,c)=>n+(c/length)**2,0),meanRun=Math.round(1/Math.max(1/length,(1-chance)*(1-target.clustering[0]/255)));
 for(const run of new Set([1,4,16,Math.max(1,Math.min(length,meanRun)),length])){
  const remaining=[...counts],used=target.pairs.map(()=>0),row:number[]=[];let previous=-1,turn=0,boundaries=0;
  while(row.length<length){const available=order.filter(i=>remaining[i]>0&&i!==previous),choices=available.length?available:order.filter(i=>remaining[i]>0);let color=choices[turn++%choices.length];
   if(previous>=0){let deficit=-Infinity;for(const c of choices){const at=relationPair(previous,c),wanted=previous===c?0:(boundaries+1)*(target.pairs[at]??0)/255-(used[at]??0);if(wanted>deficit){deficit=wanted;color=c;}}}
   if(previous>=0&&previous!==color){used[relationPair(previous,color)]++;boundaries++;}const take=Math.min(run,remaining[color]);for(let n=0;n<take;n++)row.push(color);remaining[color]-=take;previous=color;
  }consider(row);if(!inverse&&error===0)return remember(best);
 }
 // Improve irregular structures with local swaps; every proposal preserves all quotas.
 const stats=relationCounts(counts.length);addRelationRow(stats,best);let random=0x6d2b79f5;
 const nextIndex=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return (random>>>0)%length;};
 const adjust=(a:number,b:number,sign:number)=>{for(let k=0;k<RELATION_LAGS.length;k++){const lag=RELATION_LAGS[k]%length,starts=new Set([a,b,(a-lag+length)%length,(b-lag+length)%length]);for(const at of starts)stats.same[k]+=sign*Number(best[at]===best[(at+lag)%length]);}
  for(const at of new Set([a,b,(a-1+length)%length,(b-1+length)%length])){const x=best[at],y=best[(at+1)%length];if(x!==y)stats.pairs[relationPair(x,y)]+=sign;}
 };
 for(let trial=0;trial<Math.min(512,length*8,Math.max(8,Math.floor(32768/Math.max(1,target.pairs.length))));trial++){const a=nextIndex(),b=nextIndex();if(a===b||best[a]===best[b])continue;adjust(a,b,-1);[best[a],best[b]]=[best[b],best[a]];adjust(a,b,1);const next=relationError(relationProfile(stats),target,inverse);if(next<error-1e-9)error=next;else{adjust(a,b,-1);[best[a],best[b]]=[best[b],best[a]];adjust(a,b,1);}}
 return remember(best);
}
