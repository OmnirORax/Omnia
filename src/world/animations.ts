import {defaultSettings} from '../composer/runtime/workspaceActions.ts';
import {legacyValue} from '../composer/runtime/appearance/resolve.ts';
import {ANIMATION_TARGETS,type Animations} from '../properties/animations.ts';
import type {Value} from '../properties/pool.ts';
import {EFFECT_PROPERTIES} from '../composer/runtime/properties/catalog.ts';

const defaults=defaultSettings().appearance;
export function animationValue(animations:Animations|undefined,target:string,key:string):Value {
  return animations?.[target]?.[key] ?? legacyValue(defaults,ANIMATION_TARGETS.find(item=>item.id===target)!,key);
}
export function animationAppearance(animations?:Animations) {
  return {...defaults,renderDefaults:Object.fromEntries(ANIMATION_TARGETS.map(target=>[target.id,
    Object.fromEntries(EFFECT_PROPERTIES.map(key=>[key,animationValue(animations,target.id,key)]))]))};
}
