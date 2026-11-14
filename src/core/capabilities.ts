import {NODE_VISUAL_PROPERTIES,NODE_VISUAL_DEFAULTS} from '../properties/nodeVisuals.ts';
import type { Structure, Vec3, World } from './model.ts';
import { prepareTranslation, address } from './lattice.ts';
import { property, type Property } from '../properties/pool.ts';

import { color } from '../properties/visual.ts';
export { color };
export const label = property({ key: 'label', label: 'Label', kind: 'text' });
export const position = ['X', 'Y', 'Z'].map((label, i) => property({ key: `position.${i}`, label, kind: 'number', unit: 'world' }));
export const carrierProperties = NODE_VISUAL_PROPERTIES.filter(p=>p.id!=='color').map(p=>({...p,key:p.id}));
export type PropertyBinding = { property: Property; read: () => string | number; write: (value: string | number) => void };
export type Capability = { key: string; label: string; properties: PropertyBinding[] };

// UI and gestures use the same real bindings. A shared definition never implies shared values.
export function capabilities(node: Structure): Capability[] {
  const available: Capability[] = [
    { key: 'label', label: 'Label', properties: [{ property: label, read: () => node.label,
      write: value => { if (typeof value !== 'string' || value.length > 160) throw new Error('Label is limited to 160 characters.'); node.label = value; },
    }] },
    { key: 'move', label: 'Move', properties: position.map((property, axis) => ({ property,
      read: () => node.position[axis], write: value => { const n = Number(value); if (!Number.isFinite(n) || Math.abs(n) > 1e7) throw new Error('Invalid coordinate.'); node.position[axis] = n; },
    })) },
    { key: 'color', label: 'Color', properties: [{ property: color, read: () => node.color,
      write: value => { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error('Invalid color.'); node.color = value;node.colorOverride=true; },
    }] },
    { key: 'carrier', label: 'Sphere', properties: carrierProperties.map(property => ({ property,
      read: () => node[property.key as keyof typeof NODE_VISUAL_DEFAULTS] as number ?? NODE_VISUAL_DEFAULTS[property.key as keyof typeof NODE_VISUAL_DEFAULTS],
      write: value => { const n = Number(value); if (!Number.isFinite(n) || n < property.min! || n > property.max!) throw Error(`Expected a value from ${property.min} to ${property.max}.`); Object.assign(node, { [property.key]: n }); },
    })) },
  ];
  return available.map(capability => ({ ...capability, properties: capability.properties.map(binding => ({ ...binding,
    write(value) { binding.write(value); if (node.variantOf && ['brightness','label','color','opacity','glow','translucency','translucencyRadius'].includes(binding.property.key)) node.overrides = [...new Set([...(node.overrides ?? []), binding.property.key])]; },
  })) }));
}

export function translate(world: World, origins: readonly Structure['origin'][], delta: Vec3) {
  const targets = prepareTranslation(world, origins)(delta);
  if (!targets) throw Error('That lattice landing is occupied.');
  for (const node of world.nodes) { const target = targets.get(address(node.origin)); if (target) node.position = target; }
}
