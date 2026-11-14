import { panel } from '../ui/panel.ts';
import {updateCameraGuide} from '../cameraGuideState.ts';
import type {PerspectiveCamera,Vector3} from 'three';

export type CameraAction='zoom100'|'cameraOrigin'|'rollLeft'|'rollRight'|'front'|'all'|'back'|'settings';
export const CAMERA_ACTIONS=[['zoom100','100%'],['cameraOrigin','Origin'],['rollLeft','↶'],['rollRight','↷'],['front','Front'],['all','Fit all'],['back','Back'],['settings','Navigation']] as const;
/** V1 guide markup and updater, hosted by the current window owner. */
export function cameraHUD(action:(action:CameraAction)=>void){
 const view=panel('Camera & rotation');view.root.classList.add('world-camera-guide');
 Object.assign(view.root.style,{left:'12px',right:'auto',top:'auto',bottom:'12px',width:'245px'});
 view.root.addEventListener('pointerdown',event=>{if(event.target instanceof Element&&event.target.closest('header')){const box=view.root.getBoundingClientRect();view.root.style.top=`${box.top}px`;view.root.style.bottom='auto';}},true);
 const guide=document.createElement('div');guide.className='camera-guide';guide.setAttribute('aria-label','Zoom and world origin compass');
 guide.innerHTML=`<div class="camera-guide-heading"><output data-camera="zoom">Zoom 100%</output></div><div class="camera-guide-body"><svg viewBox="0 0 96 96" role="img" aria-label="World XYZ axes in the current camera orientation">${(['x','y','z'] as const).flatMap((axis,i)=>[-1,1].map(sign=>`<g data-compass="${axis}:${sign}" stroke="${['#f68b88','#8cdb9b','#89baff'][i]}" fill="${['#f68b88','#8cdb9b','#89baff'][i]}"><line x1="48" y1="48" x2="48" y2="48" stroke-width="${sign>0?2:1}"/><text text-anchor="middle" dominant-baseline="central" stroke="none" font-size="10">${sign>0?'+':'−'}${axis.toUpperCase()}</text></g>`)).join('')}<circle cx="48" cy="48" r="3" fill="#e6eff9"/></svg><div><strong>World origin</strong><div>0, 0, 0</div><small>Y up · XY text plane</small></div></div><dl><dt>Looking</dt><dd data-camera="direction"></dd><dt>Camera</dt><dd data-camera="position"></dd><dt>Orbit target</dt><dd data-camera="target"></dd><dt>Node world XYZ</dt><dd data-camera="node">Select a node</dd></dl>`;
 const actions=document.createElement('div');actions.className='camera-guide-actions';
 for(const [key,label] of CAMERA_ACTIONS){const button=document.createElement('button');button.textContent=label;button.type='button';button.onclick=()=>action(key);actions.append(button);}
 guide.append(actions);view.body.append(guide);
 return {root:view.root,close:view.close,show(){view.show();},update(camera:PerspectiveCamera,target:Vector3,selected?:Vector3){updateCameraGuide(guide,camera,target,selected);}};
}
