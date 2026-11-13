import {useEffect,useRef,type ReactNode} from 'react';
export function UISection({id,title,children,className='',defaultExpanded=true,expanded,reveal}: {id:string;title:string;children:ReactNode;className?:string;defaultExpanded?:boolean;expanded?:boolean;reveal?:boolean;legacyTag?:string}){
 const ref=useRef<HTMLDetailsElement>(null);useEffect(()=>{if(ref.current&&(expanded!==undefined||reveal))ref.current.open=reveal||!!expanded;},[expanded,reveal]);
 return <details ref={ref} className={`ui-section ${className}`} data-ui-section={id} open={expanded??defaultExpanded}><summary>{title}</summary>{children}</details>;
}
