import {normalizeSearch} from '../ui/searchMatching.ts';
export type FilterOption={id:string;label:string};
export type FilterFacet<T,Context>={id:string;label:string;options:readonly FilterOption[];read:(item:T,context:Context)=>readonly string[]};
export type FilterSchema<T,Context>={text:(item:T,context:Context)=>string;facets:readonly FilterFacet<T,Context>[]};
export type FilterState={query:string;choices:Record<string,string>};
export const emptyFilters=():FilterState=>({query:'',choices:{}});
export function normalizeFilters<T,C>(schema:FilterSchema<T,C>,state:FilterState):FilterState{
 const choices:Record<string,string>={};
 for(const facet of schema.facets){const value=state.choices[facet.id];if(facet.options.some(option=>option.id===value))choices[facet.id]=value;}
 return {query:state.query.slice(0,200),choices};
}
/** Domain adapters prepare searchable text and facet facts once per snapshot.
 * Queries never call domain accessors, evaluate geometry or discover controls. */
export function prepareFilters<T,C>(items:readonly T[],schema:FilterSchema<T,C>,context:C){
 const ids=new Set<string>();
 for(const facet of schema.facets){if(!facet.id||ids.has(facet.id)||new Set(facet.options.map(option=>option.id)).size!==facet.options.length||facet.options.some(option=>!option.id))throw Error('Filter facet and option IDs must be nonempty and unique.');ids.add(facet.id);}
 const rows=items.map(item=>({item,text:normalizeSearch(schema.text(item,context)),facts:Object.fromEntries(schema.facets.map(facet=>[facet.id,new Set(facet.read(item,context))]))}));
 return {schema,rows};
}
export function applyFilters<T,C>(index:ReturnType<typeof prepareFilters<T,C>>,supplied:FilterState){
 const state=normalizeFilters(index.schema,supplied),tokens=normalizeSearch(state.query).trim().split(/\s+/).filter(Boolean);
 const counts:Record<string,Record<string,number>>=Object.fromEntries(index.schema.facets.map(facet=>[facet.id,Object.fromEntries(facet.options.map(option=>[option.id,0]))]));
 const items:T[]=[];
 for(const row of index.rows){
  if(!tokens.every(token=>row.text.includes(token)))continue;
  const failed=Object.entries(state.choices).filter(([id,value])=>!row.facts[id].has(value)).map(([id])=>id);
  if(!failed.length)items.push(row.item);
  // Facet counts include all OTHER filters, allowing another option to be picked.
  for(const facet of index.schema.facets)if(!failed.some(id=>id!==facet.id))for(const value of row.facts[facet.id])if(Object.hasOwn(counts[facet.id],value))counts[facet.id][value]++;
 }
 return {items,counts,state,active:!!state.query.trim()||Object.keys(state.choices).length>0,total:index.rows.length};
}
export function filterPage<T>(items:readonly T[],requested:number,size:number){
 if(!Number.isInteger(size)||size<1)throw Error('Filter page size must be a positive integer.');
 const pages=Math.max(1,Math.ceil(items.length/size)),page=Math.min(pages-1,Math.max(0,Math.floor(requested)||0));
 return {page,pages,items:items.slice(page*size,(page+1)*size)};
}
