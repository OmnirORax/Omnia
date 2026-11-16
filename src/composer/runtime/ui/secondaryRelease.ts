/** Native contextmenu arrives on press in some browsers and after release in
 * others. Activate once both have happened; never expose a popup on press. */
export function createSecondaryRelease<T>() {
  let pending: {value:T; released:boolean; context:boolean;start?:{x:number;y:number}}|undefined;
  const take=()=>{
    if(!pending?.released||!pending.context)return undefined;
    const value=pending.value;pending=undefined;return value;
  };
  return {
    hasPress:()=>!!pending,
    press(value:T,start?:{x:number;y:number}){pending={value,released:false,context:false,start};},
    move(point:{x:number;y:number}){if(!pending?.start||pending.released||point.x===pending.start.x&&point.y===pending.start.y)return false;pending=undefined;return true;},
    release(value:T,point?:{x:number;y:number}){if(point&&pending?.start&&(point.x!==pending.start.x||point.y!==pending.start.y))pending=undefined;if(pending){pending.value=value;pending.released=true;}return take();},
    context(){if(pending)pending.context=true;return take();},
    cancel(){pending=undefined;},
  };
}
