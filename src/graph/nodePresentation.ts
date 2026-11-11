/** Transient atlas presentation; never authored graph geometry or parentage. */
export type NodeNames = 'expanded' | 'all' | 'selection';
export type ExpansionState = { open: Set<string>; closed: Set<string> };
export const expansionState = (): ExpansionState => ({open:new Set(),closed:new Set()});
export function contentExpanded(state:ExpansionState,id:string,structurallyExpanded:boolean) {
 return state.open.has(id)||(!state.closed.has(id)&&structurallyExpanded);
}
export function toggleContent(state:ExpansionState,id:string,structurallyExpanded:boolean) {
 if(contentExpanded(state,id,structurallyExpanded)){state.open.delete(id);state.closed.add(id);}
 else {state.closed.delete(id);state.open.add(id);}
}

/** Incoming context belongs to the downstream node, never its source or hover. */
export function incomingBinderVisible(target:string,selected:boolean,state:ExpansionState) {
 return selected || state.open.has(target);
}
