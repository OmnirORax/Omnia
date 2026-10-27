/** One subtree walk per added branch, even when MutationObserver reports nested
 * additions in the same batch. Text/attribute changes are handled as single hosts. */
export function minimalMutationRoots(nodes:Iterable<Element>):Element[]{
  const roots=new Set(nodes);
  return [...roots].filter(node=>{
    for(let parent=node.parentElement;parent;parent=parent.parentElement)if(roots.has(parent))return false;
    return true;
  });
}
