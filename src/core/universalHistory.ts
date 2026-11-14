import {createActionHistory} from '../composer/runtime/ui/actionHistory.ts';
/** V1's patch-based coordinator is shared by workspace, camera and native UI. */
export const universalHistory=createActionHistory({mode:'recent',categories:['omnium','ui','appearance','settings','camera'],steps:1,limit:10,minimum:1});
