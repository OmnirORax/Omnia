/** Small, color-indexed statistics shared by source sampling and pattern matching. */
/** One byte per swatch index in the shared text raster. */
export const PALETTE_COLOR_LIMIT=256;
export const RELATION_LAGS=[1,4,16] as const;
export type RelationProfile={clustering:readonly number[];pairs:readonly number[]};
export type ColorRelations={horizontal:RelationProfile;vertical:RelationProfile};
export const relationPair=(a:number,b:number)=>{const hi=Math.max(a,b);return hi*(hi-1)/2+Math.min(a,b);};
export function validColorRelations(value:unknown,colors:number):value is ColorRelations{
 const v=value as ColorRelations;if(!Number.isInteger(colors)||colors<1||colors>PALETTE_COLOR_LIMIT)return false;if(!v||typeof v!=='object'||Array.isArray(v))return false;
 return [v.horizontal,v.vertical].every(p=>p&&typeof p==='object'&&Array.isArray(p.clustering)&&p.clustering.length===RELATION_LAGS.length&&p.clustering.every(n=>Number.isInteger(n)&&n>=-255&&n<=255)&&Array.isArray(p.pairs)&&p.pairs.length===colors*(colors-1)/2&&p.pairs.every(n=>Number.isInteger(n)&&n>=0&&n<=255));
}
export function relationCounts(colors:number){return {weights:Array<number>(colors).fill(0),same:Array<number>(RELATION_LAGS.length).fill(0),total:0,pairs:Array<number>(colors*(colors-1)/2).fill(0)};}
export type RelationCounts=ReturnType<typeof relationCounts>;
export function addRelationRow(counts:RelationCounts,row:readonly number[]){
 if(!row.length)return;counts.total+=row.length;
 for(let i=0;i<row.length;i++){const a=row[i];counts.weights[a]++;for(let k=0;k<RELATION_LAGS.length;k++)counts.same[k]+=Number(a===row[(i+RELATION_LAGS[k])%row.length]);const b=row[(i+1)%row.length];if(a!==b)counts.pairs[relationPair(a,b)]++;}
}
/** Remove chance co-occurrence so changing occupation doesn't redefine relationships. */
export function relationProfile(counts:RelationCounts):RelationProfile{
 const sum=counts.weights.reduce((a,b)=>a+b,0),weights=counts.weights.map(n=>n/Math.max(1,sum)),chance=weights.reduce((n,w)=>n+w*w,0),pairs=Array<number>(counts.pairs.length);for(let b=1;b<weights.length;b++)for(let a=0;a<b;a++){const k=relationPair(a,b);pairs[k]=counts.pairs[k]/Math.max(1e-9,weights[a]*weights[b]);}const pairTotal=pairs.reduce((a,b)=>a+b,0);
 return {clustering:counts.same.map(n=>Math.round(255*Math.max(-1,Math.min(1,(n/Math.max(1,counts.total)-chance)/Math.max(1e-9,1-chance))))),pairs:pairs.map(n=>Math.round(255*n/Math.max(1,pairTotal)))};
}
/** Inverse changes grouping while retaining the source's color pairings. */
export function relationError(actual:RelationProfile,target:RelationProfile,inverse=false){const grouping=actual.clustering.reduce((n,v,i)=>n+Math.abs(v-target.clustering[i]),0)/(510*RELATION_LAGS.length),pairing=target.pairs.some(n=>n>0)?actual.pairs.reduce((n,v,i)=>n+Math.abs(v-target.pairs[i]),0)/510:0;return (inverse?-grouping:grouping)+pairing;}
