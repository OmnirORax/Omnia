import {defineFunction} from '../properties/function.ts';
import type {WorkspaceSettings} from '../workspaceActions';
export const QUEST_AUTHOR='metrics.questAuthor';
export const QUEST_TARGET='metrics.quest.target';
export const QUEST_SECONDS='metrics.quest.seconds';
const category={id:'metrics',label:'♾️'};
export default defineFunction<WorkspaceSettings>({id:QUEST_AUTHOR,label:'Quest creation',owner:'settings',controls:['quests.publish'],group:[{...category,self:true}],inputs:{
 [QUEST_TARGET]:{
  definition:{id:QUEST_TARGET,label:'Click target',kind:'number',integer:true,initial:20,min:1,max:360000,step:1,unit:'clicks',category},
  read:settings=>settings.functionValues[QUEST_AUTHOR]?.[QUEST_TARGET]??20,
  write:(settings,value)=>({...settings,functionValues:{...settings.functionValues,[QUEST_AUTHOR]:{...settings.functionValues[QUEST_AUTHOR],[QUEST_TARGET]:value}}}),
 },
 [QUEST_SECONDS]:{
  definition:{id:QUEST_SECONDS,label:'Time limit',kind:'number',integer:true,initial:5,min:1,max:3600,step:1,unit:'seconds',category},
  read:settings=>settings.functionValues[QUEST_AUTHOR]?.[QUEST_SECONDS]??5,
  write:(settings,value)=>({...settings,functionValues:{...settings.functionValues,[QUEST_AUTHOR]:{...settings.functionValues[QUEST_AUTHOR],[QUEST_SECONDS]:value}}}),
 },
}});
