import {UIField} from '../ui/UIField';
import {UIAction} from '../ui/UIAction';
import type {useFilters} from './useFilters';
export function FilterControls<T,C>({scope,category,filters}:{scope:string;category:string;filters:ReturnType<typeof useFilters<T,C>>}){
 return <div className="shared-filter-controls" style={{display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}>
  <UIField id={`${scope}:filter:query`} label="Search" category={category}><label>Search<input type="search" maxLength={200} value={filters.state.query} onChange={event=>filters.query(event.target.value)} /></label></UIField>
  {filters.schema.facets.map(facet=><UIField key={facet.id} id={`${scope}:filter:${facet.id}`} label={facet.label} category={category}><label>{facet.label}<select value={filters.state.choices[facet.id]??''} onChange={event=>filters.choose(facet.id,event.target.value)}><option value="">All</option>{facet.options.map(option=><option key={option.id} value={option.id}>{option.label} ({filters.counts[facet.id][option.id]})</option>)}</select></label></UIField>)}
  <UIAction id={`${scope}:filter:reset`} label="Clear filters" category={category} disabled={!filters.active} onClick={filters.reset}/>
  <small aria-live="polite">{filters.matched} / {filters.total}</small>
 </div>;
}
export function FilterPagination<T,C>({scope,category,filters}:{scope:string;category:string;filters:ReturnType<typeof useFilters<T,C>>}){
 return filters.pages>1?<div style={{display:'flex',gap:4,alignItems:'center'}}><UIAction id={`${scope}:previous`} label="Previous page" category={category} disabled={filters.page===0} onClick={filters.previous}/><small>{filters.page+1}/{filters.pages}</small><UIAction id={`${scope}:next`} label="Next page" category={category} disabled={filters.page===filters.pages-1} onClick={filters.next}/></div>:null;
}
