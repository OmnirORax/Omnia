import {universalHistory} from '../core/universalHistory.ts';
let panelSequence=0;
function retainedGeometry(initial:string){let value=initial;return {read:()=>value,write:(next:string)=>{value=next;}};}
let openingPoint: { x: number; y: number } | undefined;
document.addEventListener('pointerdown', event => { openingPoint = { x: event.clientX, y: event.clientY }; }, true);

export function panel(title: string, onClose?: () => void | boolean) {
  const owner=`panel:${++panelSequence}`;
  const point = openingPoint;
  const root = document.createElement('section'); root.className = 'panel'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', title);
  root.dataset.inputOwner = '';
  const heading = document.createElement('header'), caption = document.createElement('span'), close = document.createElement('button'), body = document.createElement('div');
  caption.textContent = title; close.textContent = '×'; close.setAttribute('aria-label', 'Close'); body.className = 'panel-body';
  const stopHistory=universalHistory.register(owner,{read:()=>root.style.cssText,write:value=>{root.style.cssText=value;}});
  const recordGeometry=(before:string)=>universalHistory.record(owner,before,root.style.cssText,['ui'],['omnium',owner]);
  const dispose = () => { if (onClose?.() === false) return;stopHistory();universalHistory.register(owner,retainedGeometry(root.style.cssText));root.remove(); };
  root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); dispose(); } });
  close.onclick = dispose; heading.append(caption, close); root.append(heading, body); document.body.append(root);
  requestAnimationFrame(() => {
    if (!root.isConnected || !point) return;
    const box = root.getBoundingClientRect();
    const left = Math.max(8, Math.min(point.x, innerWidth - box.width - 8));
    const top = Math.max(8, Math.min(point.y, innerHeight - box.height - 8));
    root.style.left = `${left}px`; root.style.top = `${top}px`; root.style.right = 'auto';

  });
  const maximize = document.createElement('button'); maximize.textContent='□'; maximize.setAttribute('aria-label','Maximize');
  let restored: string | undefined;
  maximize.onclick=()=>{
    const before=root.style.cssText;
    if(root.style.height!=='calc(100svh - 16px)'){restored=root.style.cssText;Object.assign(root.style,{left:'8px',top:'8px',right:'auto',width:'calc(100vw - 16px)',height:'calc(100svh - 16px)'});maximize.setAttribute('aria-label','Restore');}
    else {root.style.cssText=restored??'';restored=undefined;maximize.setAttribute('aria-label','Maximize');}
    recordGeometry(before);
  };
  const actions=document.createElement('div');actions.append(maximize,close);heading.append(actions);
  heading.onpointerdown = event => {
    if (actions.contains(event.target as Node) || event.button !== 0) return;
    const before=root.style.cssText,box = root.getBoundingClientRect(), start = { x: event.clientX, y: event.clientY };
    heading.setPointerCapture(event.pointerId);
    heading.onpointermove = move => { root.style.left = `${Math.max(0, Math.min(innerWidth - 40, box.left + move.clientX - start.x))}px`; root.style.top = `${Math.max(0, Math.min(innerHeight - 30, box.top + move.clientY - start.y))}px`; root.style.right = 'auto'; };
    heading.onpointerup = () => {heading.onpointermove=null;recordGeometry(before);};
    heading.onpointercancel = () => {heading.onpointermove=null;root.style.cssText=before;};
  };
  return { root, body, close: dispose };
}
