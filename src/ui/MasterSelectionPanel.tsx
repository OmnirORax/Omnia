import {UIContainerContext} from './context';
import {useContext,useRef,useSyncExternalStore} from 'react';
import {masterSelection} from './masterSelection';
import {UISection} from './UISection';
import {useActiveLayer} from './ActiveContext';
/** MC hosts the request, using its normal section/row and Escape lifecycle. */
export function MasterSelectionPanel(){
 const owner=useContext(UIContainerContext);
 const request=useSyncExternalStore(masterSelection.subscribe,masterSelection.getSnapshot),root=useRef<HTMLDivElement>(null);
 useActiveLayer(!!request,root,masterSelection.cancel,owner??undefined);
 if(!request)return null;
 const index=new Map(request.choices.map(choice=>[choice.id,choice]));
 const depth=(id:string)=>{let parent=index.get(id)?.parent,n=0;const seen=new Set([id]);while(parent&&index.has(parent)&&!seen.has(parent)){seen.add(parent);n++;parent=index.get(parent)?.parent;}return n;};
 return <UISection id="master-selection" title={request.label} reveal expanded>
  <div ref={root} className="appearance-tree" aria-label={request.label}>
   {request.choices.map(choice=><div key={choice.id} className="appearance-row" style={{paddingLeft:depth(choice.id)*12}}>
    <button type="button" data-ui-preserve-title title={choice.label} aria-pressed={request.selected===choice.id} onClick={()=>masterSelection.choose(choice.id)}>{choice.symbol??'○'} {choice.label}</button>
   </div>)}
  </div>
 </UISection>;
}
