import {useEffect} from 'react';
import {useFeatureActions} from '../ui/useFeatureActions';
export function OmnicWorkspaceActions({selected,canShow,onOpen,onCreate,onShow,onLibrary}:{selected:boolean;canShow:boolean;onOpen:()=>void;onCreate:()=>void;onShow:()=>void;onLibrary:()=>void}) {
  const commands=useFeatureActions('omnicWorkspace',{
    'omnic.library':{enabled:true,run:onLibrary},'omnic.create':{enabled:true,run:onCreate},'omnic.open':{enabled:selected,run:onOpen},'omnic.show':{enabled:canShow,run:onShow},
  });
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
  return null;
}
