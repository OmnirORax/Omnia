import {useEffect} from 'react';
import {useFeatureActions} from '../ui/useFeatureActions';
export function OmnicWorkspaceActions({selected,canShow,onOpen,onCreate,onShow}:{selected:boolean;canShow:boolean;onOpen:()=>void;onCreate:()=>void;onShow:()=>void}) {
  const commands=useFeatureActions('omnicWorkspace',{
    'omnic.create':{enabled:true,run:onCreate},'omnic.open':{enabled:selected,run:onOpen},'omnic.show':{enabled:canShow,run:onShow},
  });
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
  return null;
}
