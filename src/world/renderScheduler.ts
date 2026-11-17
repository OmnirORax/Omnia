type Clock={now:()=>number;frame:(run:(time:number)=>void)=>number;cancelFrame:(id:number)=>void;task:(run:()=>void,delay:number)=>ReturnType<typeof setTimeout>;cancelTask:(id:ReturnType<typeof setTimeout>)=>void};
/** One render owner. Interactive input may rescue a stalled frame, never duplicate it. */
export function createRenderScheduler(render:(time:number)=>void,clock:Clock={now:()=>performance.now(),frame:run=>requestAnimationFrame(run),cancelFrame:id=>cancelAnimationFrame(id),task:(run,delay)=>setTimeout(run,delay),cancelTask:id=>clearTimeout(id)}){
 let frame:number|undefined,task:ReturnType<typeof setTimeout>|undefined,last=-Infinity;
 const cancel=()=>{if(frame!==undefined)clock.cancelFrame(frame);if(task!==undefined)clock.cancelTask(task);frame=task=undefined;};
 const draw=(time:number)=>{cancel();last=time;render(time);};
 return {request(interactive=false){if(frame===undefined)frame=clock.frame(draw);if(interactive&&task===undefined)task=clock.task(()=>draw(clock.now()),Math.max(0,1000/60-(clock.now()-last)));},cancel};
}
