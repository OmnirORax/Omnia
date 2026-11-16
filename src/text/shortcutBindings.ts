import type {KeyBinding} from '@codemirror/view';
import {normalizeShortcut,shortcutBinding,type ShortcutDefinition} from '../ui/shortcuts.ts';
export function documentBindings(bindings:readonly KeyBinding[],mac=typeof navigator!=='undefined'&&/Mac/.test(navigator.platform)){
 const result:{definition:ShortcutDefinition;binding:KeyBinding}[]=[];
 for(const binding of bindings){const source=mac?binding.mac??binding.key:typeof navigator!=='undefined'&&/Win/.test(navigator.platform)?binding.win??binding.key:binding.linux??binding.key;if(!source)continue;
  const key=normalizeShortcut(source,mac);if(!key)continue;
  const {mac:_mac,win:_win,linux:_linux,shift,key:_key,...rest}=binding;
  const add=(key:string,run:KeyBinding['run'])=>{if(run)result.push({definition:{category:'Document',id:key,label:run.name.replace(/([a-z])([A-Z])/g,'$1 $2')||key,defaultKey:key},binding:{...rest,run}});};
  add(key,binding.run);if(shift){const shifted=normalizeShortcut(`Shift+${key}`,mac)!;add(shifted,shift);}
 }
 return result;
}
export function remapDocumentBindings(bindings:readonly KeyBinding[]){
 return documentBindings(bindings).flatMap(({definition,binding})=>{const key=shortcutBinding('Document',definition.id,definition.defaultKey);if(!key)return [];
  const parts=key.endsWith('+')?key.slice(0,-1).replace(/\+$/,'').split('+').filter(Boolean):key.split('+'),last=key.endsWith('+')?'+':parts.pop()!,name=last==='Esc'?'Escape':last==='Space'?'Space':last.length===1?last.toLowerCase():last;
  return [{...binding,key:[...parts.map(part=>part==='Cmd'?'Meta':part),name].join('-')}];
 });
}
