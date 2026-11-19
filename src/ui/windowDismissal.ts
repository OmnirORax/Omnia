type WindowRoot = Pick<HTMLElement, 'contains' | 'isConnected'>;
/** One Escape closes one live window. Outside presses leave it registered. */
export function createWindowDismissal() {
  let sequence = 0;
  const entries = new Map<WindowRoot, { close: () => unknown; order: number; priority: number; escape: boolean;confirm?:()=>unknown }>();
  const top=()=>[...entries].filter(([root])=>root.isConnected).sort((a,b)=>b[1].priority-a[1].priority||b[1].order-a[1].order)[0];
  return {
    register(root: WindowRoot, close: () => unknown, priority = 0, escape = true, confirm?:()=>unknown) {
      const entry = { close, order: ++sequence, priority, escape,confirm }; entries.set(root, entry);
      return () => { if (entries.get(root) === entry) entries.delete(root); };
    },
    activate(target: Node) {
      const matching = [...entries.keys()].filter(root => root.isConnected && root.contains(target));
      // Nested windows own the press before their enclosing window.
      const root = matching.find(root => !matching.some(other => other !== root && root.contains(other as Node)));
      if (root) entries.get(root)!.order = ++sequence;
    },
    owns(target:Node){return !!top()?.[0].contains(target);},
    canConfirm(){return !!top()?.[1].confirm;},
    confirm(){const entry=top()?.[1];if(!entry?.confirm)return false;entry.confirm();return true;},
    close() {
      const entry=top()?.[1];
      if (!entry) return false;
      if(entry.escape)entry.close(); return true;
    },
  };
}
const windows = createWindowDismissal();
let listening = false;
export function registerWindow(root: HTMLElement, close: () => unknown, priority = 0, escape = true, confirm?:()=>unknown) {
  if (!listening) {
    listening = true;
    const activate = (event: Event) => { if (event.target instanceof Node) windows.activate(event.target); };
    window.addEventListener('pointerdown', activate, true);
    window.addEventListener('focusin', activate, true);
  }
  return windows.register(root, close, priority, escape,confirm);
}
export const closeActiveWindow = () => windows.close();

export const confirmActiveWindow=()=>windows.confirm();
export const hasConfirmableWindow=()=>windows.canConfirm();
export const activeWindowOwns=(target:Node)=>windows.owns(target);
