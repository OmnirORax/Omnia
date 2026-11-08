import {defineFunction} from '../properties/function.ts';
import type {WorkspaceSettings} from '../workspaceActions.ts';
import {NORMALIZATION_FIELDS,NORMALIZATION_FUNCTION,normalizationProperty} from './normalization.ts';
export default defineFunction<WorkspaceSettings>({
 id:NORMALIZATION_FUNCTION,label:'Scene image normalization',owner:'settings',group:[{id:'scene',label:'Scene'}],
 controls:NORMALIZATION_FIELDS.map(field=>normalizationProperty(field.key)),
 inputs:Object.fromEntries(NORMALIZATION_FIELDS.map(field=>{const id=normalizationProperty(field.key);return [id,{
  definition:{id,label:field.label,kind:field.kind,initial:field.initial,...(field.kind==='number'?{min:field.min,max:field.max,step:.01}:{}),category:{id:'scene',label:'Scene'}},
  read:(settings:WorkspaceSettings)=>settings.functionValues[NORMALIZATION_FUNCTION]?.[id]??field.initial,
  write:(settings:WorkspaceSettings,value:string|number|boolean)=>({...settings,functionValues:{...settings.functionValues,[NORMALIZATION_FUNCTION]:{...settings.functionValues[NORMALIZATION_FUNCTION],[id]:value}}}),
 }];})),
});
