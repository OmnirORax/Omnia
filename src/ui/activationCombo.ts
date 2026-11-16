import {normalizeShortcut} from './shortcuts.ts';
/** Activation only: the action owns click/drag/release behavior. */
export function normalizeActivation(value:string){
 const parts=value.trim().replace(/\s+/g,'').replace(/Leftclick|LC/ig,'MB1').replace(/Rightclick|RC/ig,'MB2').replace(/Middleclick/ig,'MB3').split('+');
 const last=parts.pop();if(!last)return;if(!/^(MB[123]|Wheel)$/i.test(last))return /^(Ctrl|Alt|Shift)$/i.test(value)?value[0].toUpperCase()+value.slice(1).toLowerCase():normalizeShortcut(value);
 const mods=new Set<string>(),keys:string[]=[];
 for(const part of parts){const mod=/^(Ctrl|Control|Cmd|Meta|Shift|Alt)$/i.test(part);if(mod)mods.add(/^(Ctrl|Control|Cmd|Meta)$/i.test(part)?'Ctrl':part.toLowerCase()==='shift'?'Shift':'Alt');else if(/^[a-z0-9]$/i.test(part))keys.push(part.toUpperCase());else return;}
 return [...['Ctrl','Alt','Shift'].filter(m=>mods.has(m)),...[...new Set(keys)].sort(),last.toLowerCase()==='wheel'?'Wheel':last.toUpperCase()].join('+');
}
export function pointerCombo(event:Pick<MouseEvent,'button'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>,held:readonly string[]=[],wheel=false){return normalizeActivation([event.ctrlKey||event.metaKey?'Ctrl':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',...held,wheel?'Wheel':`MB${event.button===0?1:event.button===2?2:3}`].filter(Boolean).join('+'));}
