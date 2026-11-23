import {createInfinitySystem} from './system.ts';
export {createInfinitySystem} from './system.ts';
export {createScoreTracker,formatTime,clicksPerSecond,SCORE_LIMITS} from './model.ts';
export type {Result,ScoreState,TimerOptions,Split} from './model.ts';
export type {Benchmark,Quest,QuestData,Standing,Attempt} from './cloud.ts';
let system:ReturnType<typeof createInfinitySystem>|undefined;
/** Shared, lazy entry point for future V2 consumers; it mounts no UI. */
export async function infinitySystem(){
 if(!system||system.disposed){
  const {backendClient}=await import('../backend/client.ts');
  if(!system||system.disposed)system=createInfinitySystem(backendClient());
 }
 return system;
}
