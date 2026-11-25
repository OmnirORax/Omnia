import type {EditorView} from '@codemirror/view';

export function observeDocumentViewport(view:EditorView,refresh:()=>void){
 view.scrollDOM.addEventListener('scroll',refresh,{passive:true});
 window.addEventListener('resize',refresh);
 const panel=view.dom.closest('.node-document-panel'),observer=new MutationObserver(refresh);
 if(panel)observer.observe(panel,{attributes:true,attributeFilter:['style']});
 return ()=>{observer.disconnect();window.removeEventListener('resize',refresh);view.scrollDOM.removeEventListener('scroll',refresh);};
}
