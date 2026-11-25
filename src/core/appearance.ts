import {NODE_VISUAL_DEFAULTS,validateNodePaint,type NodePaint} from '../properties/nodeVisuals.ts';
import {brightHex} from '../composer/runtime/appearance/resolve.ts';
import { locate, type Origin, type World, type Structure } from './model.ts';
import { inherited,createInheritanceReader } from './lattice.ts';
import { capabilities } from './capabilities.ts';
import { BACKGROUND_DEFAULTS, resolvedTextPaint, validatePaint } from '../properties/visual.ts';
import { SPHERE_VISUAL_DEFAULTS } from '../properties/sphereVisualDefaults.ts';
import {translucentOpacity} from '../properties/translucency.ts';

export type VisualTarget = 'nodeDefaults' | 'nodes' | 'nodeText' | 'text' | 'background';
/** Resolve defaults once in the existing node update; author values remain untouched. */
export function nodePaint(world:World,node?:Structure):NodePaint {
 const base={...NODE_VISUAL_DEFAULTS,...world.appearance?.nodes};
 if(!node)return base;
 return {...base,color:node.colorOverride||node.variantOf&&node.overrides?.includes('color')||node.color!==SPHERE_VISUAL_DEFAULTS.color?node.color:base.color,
  brightness:node.brightness??base.brightness,opacity:node.opacity??base.opacity,
  translucency:node.translucency??base.translucency,translucencyRadius:node.translucencyRadius??base.translucencyRadius,glowColor:node.glowColor??base.glowColor,glow:node.glow??base.glow};
}
/** Outgoing connections share their source's resolved visual channels. */
export function connectorPaint(world:World,source:Structure,actual=inherited(source,world)) {
 const paint=nodePaint(world,actual);
 return {color:brightHex(paint.color!,paint.brightness!),opacity:translucentOpacity(paint.opacity!,paint.translucency),glow:paint.glow!,...(paint.glowColor?{glowColor:paint.glowColor}:{})};
}
/** A fresh reader per render/preview pass avoids repeating inheritance per edge. */
export function connectorPaintReader(world:World){
 const inherit=createInheritanceReader(world),paints=new Map<Structure,ReturnType<typeof connectorPaint>>();return (source:Structure)=>{let paint=paints.get(source);if(!paint){paint=connectorPaint(world,source,inherit(source));paints.set(source,paint);}return paint;};
}
export function resolveNodeSettings(world:World,node:Structure):Structure {
 if(!world.appearance?.nodes&&node.brightness===undefined)return node;
 const paint=nodePaint(world,node);return {...node,...paint,color:paint.color!};
}
export function resolveNodeAppearance(world:World,node:Structure):Structure {
 const actual=resolveNodeSettings(world,node);return actual.brightness===undefined||actual.brightness===1?actual:{...actual,color:brightHex(actual.color,actual.brightness)};
}
function unresolvedPaint(world: World, target: VisualTarget, origin?: Origin): NodePaint {
 if(target==='nodeDefaults')return nodePaint(world);
 if(target==='background')return {...BACKGROUND_DEFAULTS,...world.appearance?.background};
 if(target==='text')return resolvedTextPaint(world.appearance?.text);
 const node=origin&&locate(world,origin),actual=node&&inherited(node,world);
 if(target==='nodes')return nodePaint(world,actual);
 return resolvedNodeTextPaint(world,actual);
}
export function readPaint(world:World,target:VisualTarget,origin?:Origin):NodePaint{const paint=unresolvedPaint(world,target,origin);return {...paint,glowColor:paint.glowColor??paint.color};}
export function writePaint(world: World, target: VisualTarget, origins: readonly Origin[], patch: NodePaint,mode:'manual'|'automatic'='manual') {
  if(target==='nodes'||target==='nodeDefaults')validateNodePaint(patch);else validatePaint(patch,target==='nodeText'||target==='text');
  if(mode==='manual'&&target!=='background')for(const origin of target==='nodes'||target==='nodeText'?origins:[undefined]){const key=origin?JSON.stringify(origin):'default',existing=world.appearance?.imageColors?.[key],rule=existing??(origin&&world.appearance?.imageColors?.default?.enabled?{enabled:false,inherit:true,manual:[]}:undefined);if(!rule?.enabled&&!rule?.inherit)continue;const text=target==='text'||target==='nodeText',manual=[...new Set([...rule.manual,...(patch.color!==undefined?[text?'text' as const:'node' as const]:[]),...(patch.glowColor!==undefined?[text?'textGlow' as const:'nodeGlow' as const]:[])])];world.appearance={...world.appearance,imageColors:{...world.appearance!.imageColors,[key]:{...rule,manual}}};}
  const clearPalette=(target==='text'||target==='nodeText')&&patch.palette===undefined&&('palette' in patch||mode==='manual'&&(patch.color!==undefined||patch.glowColor!==undefined));
  if(target==='nodes'||target==='nodeText')for(const origin of origins){
    const node=locate(world,origin);if(!node)continue;
    if(target==='nodes'){
      const bindings=capabilities(node).flatMap(capability=>capability.properties);
      for(const [key,value] of Object.entries(patch))if(typeof value==='number'||typeof value==='string')bindings.find(binding=>binding.property.key===key)?.write(value);
    }else{
      node.textAppearance={...inherited(node,world).textAppearance,...patch};if(clearPalette)delete node.textAppearance.palette;
      if(node.variantOf)node.overrides=[...new Set([...(node.overrides??[]),'textAppearance'])];
    }
  }
  else {world.appearance??={};const key=target==='nodeDefaults'?'nodes':target==='text'?'text':'background';world.appearance[key]={...world.appearance[key],...patch};if(clearPalette)delete world.appearance[key]!.palette;}
}
export function resetPaint(world: World,target: VisualTarget,origins: readonly Origin[]) {
  if(target==='nodes'||target==='nodeText')for(const origin of origins){
    const node=locate(world,origin);if(!node)continue;
    const keys=target==='nodeText'?['textAppearance']:['color','brightness','opacity','glow','glowColor','translucency','translucencyRadius'];
    if(target==='nodeText')delete node.textAppearance;
    else {node.color=SPHERE_VISUAL_DEFAULTS.color;delete node.colorOverride;delete node.brightness;delete node.opacity;delete node.glow;delete node.glowColor;delete node.translucency;delete node.translucencyRadius;}
    if(node.variantOf)node.overrides=node.overrides?.filter(key=>!keys.includes(key));
  }
  else if(world.appearance)delete world.appearance[target==='nodeDefaults'?'nodes':target==='text'?'text':'background'];
}

/** Transient appearance overlays share all normal validation/inheritance, without editing the source world. */
export function paintPreview(world:World,target:VisualTarget,origins:readonly Origin[],patch:NodePaint):World{
 const selected=new Set(origins.map(origin=>JSON.stringify(origin))),local=target==='nodes'||target==='nodeText';
 const candidate={...world,appearance:{...world.appearance},nodes:local?world.nodes.map(node=>selected.has(JSON.stringify(node.origin))?{...node}:node):world.nodes};
 writePaint(candidate,target,origins,patch);return candidate;
}
function resolvedNodeTextPaint(world:World,actual?:Structure,lookup:(origin:Origin)=>Structure|undefined=origin=>locate(world,origin)){
 const local=actual?.textAppearance,paint={...world.appearance?.text,...local,...(local?.font!==undefined?{fontName:local.fontName}:{})},rules=world.appearance?.imageColors,rule=actual&&rules?.[JSON.stringify(actual.origin)];
 if(rules?.default?.enabled){
  const manual=new Set(rule?.manual);let blocked=!!rule&&(rule.enabled||!rule.inherit),parent=actual?.variantOf;const seen=new Set<Structure>();
  while(parent&&!blocked){const source=lookup(parent);if(!source||seen.has(source))break;seen.add(source);const inheritedRule=rules[JSON.stringify(source.origin)];if(inheritedRule){blocked=inheritedRule.enabled||!inheritedRule.inherit;for(const channel of inheritedRule.manual)manual.add(channel);}parent=source.variantOf;}
  if(blocked&&local?.palette===undefined&&(local?.color!==undefined||local?.glowColor!==undefined))paint.palette=undefined;
  if(!blocked){paint.palette=manual.has('text')||manual.has('textGlow')?undefined:world.appearance?.text?.palette;}
  if(!blocked)for(const [field,channel]of [['color','text'],['glowColor','textGlow']] as const)if(!manual.has(channel)){const value=world.appearance?.text?.[field];if(value!==undefined)paint[field]=value;}
 }
 if(!rules?.default?.enabled&&local?.palette===undefined&&(local?.color!==undefined||local?.glowColor!==undefined))paint.palette=undefined;
 return resolvedTextPaint(paint);
}
export function nodeTextPaint(world:World,actual:Structure,lookup?:(origin:Origin)=>Structure|undefined){return resolvedNodeTextPaint(world,actual,lookup);}
