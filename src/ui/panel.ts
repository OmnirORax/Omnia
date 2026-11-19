import {VIEW_CLOSE,VIEW_GEOMETRY} from './viewHistory.ts';
import {windowDrag} from './windowDrag';
import {registerWindow} from './windowDismissal.ts';
import {universalHistory} from '../core/universalHistory.ts';
let panelSequence=0;
function retainedGeometry(initial:string){let value=initial;return {read:()=>value,write:(next:string)=>{value=next;}};}
let openingPoint: { x: number; y: number } | undefined;
document.addEventListener('pointerdown', event => { openingPoint = { x: event.clientX, y: event.clientY }; }, true);

export function panel(title: string, onClose?: () => void | boolean, placement:'cursor'|'default'='cursor',chrome:'standard'|'edge'='standard') {
  const owner=`panel:${++panelSequence}`;
  const point = placement==='cursor'?openingPoint:undefined;
  const root = document.createElement('section'); root.className = 'panel'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', title);
  root.dataset.inputOwner = '';
  const heading = document.createElement('header'), caption = document.createElement('span'), body = document.createElement('div');
  if(chrome==='edge'){root.classList.add('edge-panel');heading.classList.add('panel-edge');}
  caption.textContent = title; body.className = 'panel-body';
  let stopHistory:(()=>void)|undefined;
  const recordGeometry=(before:string)=>{if(root.dataset.historyWindow){root.dispatchEvent(new Event(VIEW_GEOMETRY));return;}stopHistory??=universalHistory.register(owner,{read:()=>root.style.cssText,write:value=>{root.style.cssText=value;}});universalHistory.record(owner,before,root.style.cssText,['ui'],['omnium',owner]);};
  let stopWindow=()=>{};
  const dispose = () => { if (onClose?.() === false) return;root.dispatchEvent(new Event(VIEW_CLOSE));stopWindow();if(stopHistory){stopHistory();universalHistory.register(owner,retainedGeometry(root.style.cssText));}root.remove(); };
  stopWindow=registerWindow(root,dispose);
  heading.append(caption); root.append(heading, body); document.body.append(root);
  requestAnimationFrame(() => {
    if (!root.isConnected || !point || root.dataset.historyPlacement) return;
    const box = root.getBoundingClientRect();
    const left = Math.max(8, Math.min(point.x, innerWidth - box.width - 8));
    const top = Math.max(8, Math.min(point.y, innerHeight - box.height - 8));
    root.style.left = `${left}px`; root.style.top = `${top}px`; root.style.right = 'auto';

  });
  if(chrome==='standard'){
    const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close');close.onclick=dispose;
    const maximize = document.createElement('button'); maximize.textContent='□'; maximize.setAttribute('aria-label','Maximize');
    let restored: string | undefined;
    maximize.onclick=()=>{
      const before=root.style.cssText;
      if(root.style.height!=='calc(100svh - 16px)'){restored=root.style.cssText;Object.assign(root.style,{left:'8px',top:'8px',right:'auto',width:'calc(100vw - 16px)',height:'calc(100svh - 16px)'});maximize.setAttribute('aria-label','Restore');}
      else {root.style.cssText=restored??'';restored=undefined;maximize.setAttribute('aria-label','Maximize');}
      recordGeometry(before);
    };
    const actions=document.createElement('div');actions.append(maximize,close);heading.append(actions);
  }
  root.addEventListener('pointerdown',event=>{
    if(event.target!==root||event.button!==0)return;
    if(chrome==='edge'&&event.clientY<=root.getBoundingClientRect().top+10){heading.onpointerdown?.call(heading,event);return;}
    const before=root.style.cssText;
    const finish=()=>{window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);if(root.isConnected)recordGeometry(before);};
    window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);
  });
  windowDrag(root,heading,recordGeometry);

  return { root, body, close: dispose, setTitle(next:string){if(next===title)return;title=next;caption.textContent=next;root.setAttribute('aria-label',next);}, show(){if(!root.isConnected){document.body.append(root);stopWindow=registerWindow(root,dispose);}} };
}
