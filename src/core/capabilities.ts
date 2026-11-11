import type { Structure, Vec3, World } from './model.ts';

export type Property = { key: string; label: string; kind: 'color' | 'number' | 'text'; unit?: string };
export const color: Property = { key: 'color', label: 'Color', kind: 'color' };
export const label: Property = { key: 'label', label: 'Label', kind: 'text' };
export const position: Property[] = ['X', 'Y', 'Z'].map((label, i) => ({ key: `position.${i}`, label, kind: 'number', unit: 'world' }));
export type PropertyBinding = { property: Property; read: () => string | number; write: (value: string | number) => void };
export type Capability = { key: string; label: string; properties: PropertyBinding[] };

// UI and gestures use the same real bindings. A shared definition never implies shared values.
export function capabilities(node: Structure): Capability[] {
  return [
    { key: 'label', label: 'Label', properties: [{ property: label, read: () => node.label,
      write: value => { if (typeof value !== 'string' || value.length > 160) throw new Error('Label is limited to 160 characters.'); node.label = value; },
    }] },
    { key: 'move', label: 'Move', properties: position.map((property, axis) => ({ property,
      read: () => node.position[axis], write: value => { const n = Number(value); if (!Number.isFinite(n) || Math.abs(n) > 1e7) throw new Error('Invalid coordinate.'); node.position[axis] = n; },
    })) },
    { key: 'color', label: 'Color', properties: [{ property: color, read: () => node.color,
      write: value => { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw new Error('Invalid color.'); node.color = value; },
    }] },
  ];
}

export function translate(world: World, origins: readonly Structure['origin'][], delta: Vec3) {
  for (const node of world.nodes) if (origins.some(origin => origin.born === node.origin.born && origin.at.every((n, i) => n === node.origin.at[i]))) {
    const movement = capabilities(node).find(capability => capability.key === 'move')!;
    movement.properties.forEach((binding, axis) => binding.write(Number(binding.read()) + delta[axis]));
  }
}
