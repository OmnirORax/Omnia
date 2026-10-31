/** Animation time follows displayed frames, never startup/layout catch-up.
 * Recreate with retained seconds to resume without counting the paused interval. */
export function createPlaybackClock(seconds:number,fps:number){
 let previous:number|undefined;
 return (now:number)=>{
  if(previous!==undefined)seconds+=Math.max(0,Math.min(now-previous,1000/fps))/1000;
  previous=now;
  return seconds;
 };
}
