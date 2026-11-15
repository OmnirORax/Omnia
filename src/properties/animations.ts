import { EFFECT_PROPERTIES, propertyFor, validateProperty } from '../composer/runtime/properties/catalog.ts';
import { TARGETS } from '../composer/runtime/appearance/registry.ts';
import { GRAPH_EFFECT_TARGETS } from '../world/v1/graphEffects.ts';
import type { Property, Value } from './pool.ts';

// Only targets actually emitted by the world renderer; DOM effects have another owner.
export const ANIMATION_TARGETS = TARGETS.filter(target =>
  [...GRAPH_EFFECT_TARGETS, 'workspace.background'].includes(target.id) &&
  !['omnium.nodes.background', 'omnium.nodes.contour'].includes(target.id));
export type Animations = Record<string, Record<string, Value>>;
export function animationProperties(targetId: string): Property[] {
  const target = ANIMATION_TARGETS.find(target => target.id === targetId)!;
  const kinds = new Set<string>(target.effectKinds);
  return EFFECT_PROPERTIES.map(key => {
    const definition = propertyFor(key)!;
    return { ...definition, key, ...(key === 'effect' ? {options: definition.options?.filter(option => kinds.has(option.id))} : {}) };
  });
}
export function validateAnimations(value: Animations | undefined) {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid animations.');
  for (const [id, values] of Object.entries(value)) {
    if (!ANIMATION_TARGETS.some(target => target.id === id) || !values || typeof values !== 'object' || Array.isArray(values)) throw Error('Invalid animation target.');
    for (const [key, value] of Object.entries(values)) {
      if (!EFFECT_PROPERTIES.includes(key) || validateProperty(key, value) !== value ||
        key === 'effect' && !animationProperties(id).find(property => property.key === key)!.options?.some(option => option.id === value)) throw Error('Invalid animation property.');
    }
  }
}
