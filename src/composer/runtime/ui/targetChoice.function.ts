import { defineFunction } from '../properties/function.ts';
import type { WorkspaceSettings } from '../workspaceActions';
import { FEATURE_ACTIONS } from '../featureActions.ts';
/** Shared Shift priority for every contextual multi-DOF function. Normal invocation still asks. */
export default defineFunction<WorkspaceSettings>({
  id:'ui.target.choice',label:'Target DOF choice',owner:'settings',
  controls:FEATURE_ACTIONS.filter(action=>'contextual' in action).map(action=>action.id),
  group:[{id:'interface',label:'Interface'}],inputs:{
    'operation.level':{initial:1,
      read:settings=>Math.max(1,Math.min(10,Number(settings.functionValues['ui.target.choice']?.['operation.level'])||1)),
      write:(settings,value)=>({...settings,functionValues:{...settings.functionValues,'ui.target.choice':{'operation.level':Math.max(1,Math.min(10,Math.round(Number(value))))}}}),
    },
  },
});
