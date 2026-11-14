import {NODE_VISUAL_DEFAULTS,validateNodePaint,type NodePaint} from '../properties/nodeVisuals.ts';
import {brightHex} from '../composer/runtime/appearance/resolve.ts';
import { locate, type Origin, type World, type Structure } from './model.ts';
import { inherited } from './lattice.ts';
import { capabilities } from './capabilities.ts';
import { BACKGROUND_DEFAULTS, TEXT_DEFAULTS, validatePaint } from '../properties/visual.ts';
import { SPHERE_VISUAL_DEFAULTS } from '../properties/sphereVisualDefaults.ts';

export type VisualTarget = 'nodeDefaults' | 'nodes' | 'nodeText' | 'text' | 'background';
/** Resolve defaults once in the existing node update; author values remain untouched. */
export function nodePaint(world:World,node?:Structure):NodePaint {
 const base={...NODE_VISUAL_DEFAULTS,...world.appearance?.nodes};
 if(!node)return base;
 return {...base,color:node.colorOverride||node.variantOf&&node.overrides?.includes('color')||node.color!==SPHERE_VISUAL_DEFAULTS.color?node.color:base.color,
  brightness:node.brightness??base.brightness,opacity:node.opacity??base.opacity,
  translucency:node.translucency??base.translucency,translucencyRadius:node.translucencyRadius??base.translucencyRadius,glow:node.glow??base.glow};
}
export function resolveNodeSettings(world:World,node:Structure):Structure {
 if(!world.appearance?.nodes&&node.brightness===undefined)return node;
 const paint=nodePaint(world,node);return {...node,...paint,color:paint.color!};
}
export function resolveNodeAppearance(world:World,node:Structure):Structure {
 const actual=resolveNodeSettings(world,node);return actual.brightness===undefined||actual.brightness===1?actual:{...actual,color:brightHex(actual.color,actual.brightness)};
}
export function readPaint(world: World, target: VisualTarget, origin?: Origin): NodePaint {
 if(target==='nodeDefaults')return nodePaint(world);
 if(target==='background')return {...BACKGROUND_DEFAULTS,...world.appearance?.background};
 if(target==='text')return {...TEXT_DEFAULTS,...world.appearance?.text};
 const node=origin&&locate(world,origin),actual=node&&inherited(node,world);
 if(target==='nodes')return nodePaint(world,actual);
 return {...TEXT_DEFAULTS,...world.appearance?.text,...actual?.textAppearance};
}
export function writePaint(world: World, target: VisualTarget, origins: readonly Origin[], patch: NodePaint) {
  if(target==='nodes'||target==='nodeDefaults')validateNodePaint(patch);else validatePaint(patch,target==='nodeText'||target==='text');
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
    const keys=target==='nodeText'?['textAppearance']:['color','brightness','opacity','glow','translucency','translucencyRadius'];
    if(target==='nodeText')delete node.textAppearance;
    else {node.color=SPHERE_VISUAL_DEFAULTS.color;delete node.colorOverride;delete node.brightness;delete node.opacity;delete node.glow;delete node.translucency;delete node.translucencyRadius;}
    if(node.variantOf)node.overrides=node.overrides?.filter(key=>!keys.includes(key));
  }
  else if(world.appearance)delete world.appearance[target==='nodeDefaults'?'nodes':target==='text'?'text':'background'];
}
