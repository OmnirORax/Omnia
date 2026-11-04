import {useMemo,useState} from 'react';
import {applyFilters,emptyFilters,filterPage,prepareFilters,type FilterSchema,type FilterState} from './model';
export function useFilters<T,C>(items:readonly T[],schema:FilterSchema<T,C>,context:C,pageSize=12){
 const [state,setState]=useState<FilterState>(emptyFilters),[requestedPage,setPage]=useState(0);
 const index=useMemo(()=>prepareFilters(items,schema,context),[items,schema,context]);
 const result=useMemo(()=>applyFilters(index,state),[index,state]);
 const page=filterPage(result.items,requestedPage,pageSize);
 const change=(next:FilterState)=>{setState(next);setPage(0);};
 return {...result,...page,schema,matched:result.items.length,
  query:(query:string)=>change({...result.state,query}),
  choose:(facet:string,value:string)=>change({...result.state,choices:{...result.state.choices,[facet]:value}}),
  reset:()=>change(emptyFilters()),
  previous:()=>setPage(Math.max(0,page.page-1)),next:()=>setPage(Math.min(page.pages-1,page.page+1)),
  reveal:(predicate:(item:T)=>boolean)=>{let at=result.items.findIndex(predicate);if(at<0){at=items.findIndex(predicate);setState(emptyFilters());}setPage(Math.max(0,Math.floor(at/pageSize)));},
 };
}
