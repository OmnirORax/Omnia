import { locate, type Origin, type World, type Structure } from './model.ts';
import { inherited } from './lattice.ts';
import { capabilities } from './capabilities.ts';
import { BACKGROUND_DEFAULTS, TEXT_DEFAULTS, validatePaint, type Paint } from '../properties/visual.ts';
import { SPHERE_VISUAL_DEFAULTS } from '../properties/sphereVisualDefaults.ts';

export type VisualTarget = 'nodeDefaults' | 'nodes' | 'nodeText' | 'text' | 'background';
/** Resolve defaults once in the existing node update; author values remain untouched. */
export function resolveNodeAppearance(world:World,node:Structure):Structure {
  const paint=world.appearance?.nodes;if(!paint)return node;
  return {...node,color:node.colorOverride||node.variantOf&&node.overrides?.includes('color')||node.color!==SPHERE_VISUAL_DEFAULTS.color?node.color:paint.color??node.color,
    translucency:node.translucency??paint.translucency,glow:node.glow??paint.glow};
}
export function readPaint(world: World, target: VisualTarget, origin?: Origin): Paint {
  const node=origin&&locate(world,origin),actual=node&&resolveNodeAppearance(world,inherited(node,world));
  if(target==='nodeDefaults')return {color:SPHERE_VISUAL_DEFAULTS.color,translucency:SPHERE_VISUAL_DEFAULTS.translucency,glow:SPHERE_VISUAL_DEFAULTS.glow,...world.appearance?.nodes};
  if(target==='nodes')return {color:actual?.color??SPHERE_VISUAL_DEFAULTS.color,translucency:actual?.translucency??SPHERE_VISUAL_DEFAULTS.translucency,glow:actual?.glow??SPHERE_VISUAL_DEFAULTS.glow};
  if(target==='background')return {...BACKGROUND_DEFAULTS,...world.appearance?.background};
  return {...TEXT_DEFAULTS,...world.appearance?.text,...(target==='nodeText'?actual?.textAppearance:undefined)};
}
export function writePaint(world: World, target: VisualTarget, origins: readonly Origin[], patch: Paint) {
  validatePaint(patch,target==='nodeText'||target==='text');
  if(target==='nodes'||target==='nodeText')for(const origin of origins){
    const node=locate(world,origin);if(!node)continue;
    if(target==='nodes'){
      const bindings=capabilities(node).flatMap(capability=>capability.properties);
      for(const [key,value] of Object.entries(patch))bindings.find(binding=>binding.property.key===key)?.write(value);
    }else{
      node.textAppearance={...inherited(node,world).textAppearance,...patch};
      if(node.variantOf)node.overrides=[...new Set([...(node.overrides??[]),'textAppearance'])];
    }
  }
  else {world.appearance??={};const key=target==='nodeDefaults'?'nodes':target==='text'?'text':'background';world.appearance[key]={...world.appearance[key],...patch};}
}
export function resetPaint(world: World,target: VisualTarget,origins: readonly Origin[]) {
  if(target==='nodes'||target==='nodeText')for(const origin of origins){
    const node=locate(world,origin);if(!node)continue;
    const keys=target==='nodeText'?['textAppearance']:['color','glow','translucency'];
    if(target==='nodeText')delete node.textAppearance;
    else {node.color=SPHERE_VISUAL_DEFAULTS.color;delete node.colorOverride;delete node.glow;delete node.translucency;}
    if(node.variantOf)node.overrides=node.overrides?.filter(key=>!keys.includes(key));
  }
  else if(world.appearance)delete world.appearance[target==='nodeDefaults'?'nodes':target==='text'?'text':'background'];
}
