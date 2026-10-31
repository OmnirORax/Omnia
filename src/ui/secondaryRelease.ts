/** Native contextmenu arrives on press in some browsers and after release in
 * others. Activate once both have happened; never expose a popup on press. */
export function createSecondaryRelease<T>() {
  let pending: {value:T; released:boolean; context:boolean}|undefined;
  const take=()=>{
    if(!pending?.released||!pending.context)return undefined;
    const value=pending.value;pending=undefined;return value;
  };
  return {
    hasPress:()=>!!pending,
    press(value:T){pending={value,released:false,context:false};},
    release(value:T){if(pending){pending.value=value;pending.released=true;}return take();},
    context(){if(pending)pending.context=true;return take();},
    cancel(){pending=undefined;},
  };
}
