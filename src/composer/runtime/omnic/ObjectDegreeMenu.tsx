import {DegreeSetter} from './DegreeSetter';
import {RadialMenu,type RadialNavigation} from '../ui/RadialMenu';
import {UIAction} from '../ui/UIAction';
import {FunctionControl} from '../ui/UIWorkspace';
import {objectDegreeMenu} from './objectDegreeMenu';
import type {Ref,ReactNode} from 'react';
import type {RadialNode} from '../ui/radialMenuModel';
import type {EditableDegree} from '../properties/editableDegrees';
import type {Recipe} from './model';
import type {DegreeEditValue} from './targetDegrees';
export function ObjectDegreeMenu({recipe,degrees,scope,onPreview,onCommit,onOpen,onConfigure,onClose,navigationRef,extra}:{recipe:Recipe;degrees:readonly EditableDegree[];scope:string;onPreview:(degree:EditableDegree,value:DegreeEditValue)=>void;onCommit:(degree:EditableDegree,value:DegreeEditValue)=>void;onOpen:(degree:EditableDegree)=>void;onConfigure:(degree:EditableDegree)=>void;onClose:()=>void;navigationRef?:Ref<RadialNavigation>;extra?:RadialNode<ReactNode>[]}){
 return <RadialMenu navigationRef={navigationRef} onClose={onClose} items={[...objectDegreeMenu(degrees,degree=>({
  setter:<DegreeSetter recipe={recipe} degree={degree} onPreview={value=>onPreview(degree,value)} onCommit={value=>onCommit(degree,value)} onOpen={()=>onOpen(degree)}/>,
  content:<><UIAction registerOnly id={`${scope}:${degree.id}`} category="Omnic" label={degree.label} onClick={()=>onOpen(degree)} onConfigure={()=>onConfigure(degree)}/><FunctionControl id={`${scope}:${degree.id}`} mirror symbol={degree.symbol??'⊕'} symbolOpacity={degree.symbolOpacity} symbolFill={degree.symbolFill} tooltip={degree.label}/></>
 })),...(extra??[]).map(node=>({...node,row:{id:'actions',axis:{x:0,y:1}}}))]}/>;
}
