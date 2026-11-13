let front = 100;
let menuFront = 40000;
export const nextWindowLayer = () => ++front;
/** A repeated press on the front window is not another stacking change. */
export const raiseWindowLayer = (current: number) => current === front ? current : ++front;
/** Menus sit above windows and the fixed selection/search overlays. */
export const nextMenuLayer = () => menuFront = Math.max(menuFront, front) + 1;
