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
      return root;
    },
    owns(target:Node){return !!top()?.[0].contains(target);},
    confirmWithin(root:WindowRoot){const active=top();if(!active?.[1].confirm||!root.contains(active[0] as Node))return false;active[1].confirm();return true;},
    canConfirm(){return !!top()?.[1].confirm;},
    beginConfirm(target:Node){const active=top(),parent=target as HTMLElement;const host=!!active&&!!parent?.matches?.('[data-input-owner],[data-context-controller]')&&parent.contains(active[0] as Node);if(!active||!active[1].confirm||!active[0].contains(target)&&!host)return;return()=>{if(top()?.[1]===active[1])active[1].confirm?.();};},
    confirm(){const entry=top()?.[1];if(!entry?.confirm)return false;entry.confirm();return true;},
    close() {
      const entry=top()?.[1];
      if (!entry) return false;
      if(entry.escape)entry.close(); return true;
    },
  };
}
/** Confirmation owns the whole key press, before a focused button can click again. */
export function createWindowConfirmation(windows:Pick<ReturnType<typeof createWindowDismissal>,'beginConfirm'>,nativeInput:(target:EventTarget|null)=>boolean){
 let pending:(()=>void)|undefined;
 const enter=(event:KeyboardEvent)=>event.key==='Enter'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&!event.isComposing;
 const consume=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();};
 return {keydown(event:KeyboardEvent){if(event.defaultPrevented||!enter(event)||nativeInput(event.target))return;const confirm=windows.beginConfirm(event.target as Node);if(!confirm)return;consume(event);if(!event.repeat)pending=confirm;},
  keyup(event:KeyboardEvent){if(event.key!=='Enter'||!pending)return;const confirm=pending;pending=undefined;consume(event);if(enter(event)&&!nativeInput(event.target))confirm();},cancel(){pending=undefined;}};
}
const windows = createWindowDismissal();
let listening = false;
export function registerWindow(root: HTMLElement, close: () => unknown, priority = 0, escape = true, confirm?:()=>unknown) {
  if (!listening) {
    listening = true;
    const nativeInput=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input:not([type="button"]):not([type="submit"]):not([type="reset"]),textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
    const activate = (event: Event) => {
      if(!(event.target instanceof Node))return;
      const root=windows.activate(event.target) as HTMLElement|undefined;
      // Choice controls prevent pointer focus while painting. Give their active
      // confirmation owner keyboard focus instead of leaving it in the opener.
      if(event.type==='pointerdown'&&root&&windows.canConfirm()&&windows.owns(event.target)&&!nativeInput(event.target)&&(!root.contains(document.activeElement)||nativeInput(document.activeElement))){
        if(!root.hasAttribute('tabindex'))root.tabIndex=-1;
        root.focus({preventScroll:true});
      }
    };
    window.addEventListener('pointerdown', activate, true);
    window.addEventListener('focusin', activate, true);
    const confirmation=createWindowConfirmation(windows,nativeInput);
    window.addEventListener('keydown',confirmation.keydown,true);window.addEventListener('keyup',confirmation.keyup,true);window.addEventListener('blur',confirmation.cancel);
  }
  return windows.register(root, close, priority, escape,confirm);
}
export const closeActiveWindow = () => windows.close();

export const confirmActiveWindow=()=>windows.confirm();
export const hasConfirmableWindow=()=>windows.canConfirm();
export const activeWindowOwns=(target:Node)=>windows.owns(target);

export const confirmWindowWithin=(root:HTMLElement)=>windows.confirmWithin(root);
