import { GENERATORS, OPERATORS } from './registry.ts';
import type { EditableDegree } from '../properties/editableDegrees.ts';

type ExistingCommand = { id: string; adjusts?: readonly string[] };
/** Shortcut inventory derives from the same declared inputs as target editors.
 * Existing complete adjusters retain their IDs/bindings, rather than duplicate rows. */
export function composerDegreeActions(existing: readonly ExistingCommand[] = []) {
  const inputs = [...GENERATORS, ...OPERATORS].flatMap(definition => definition.parameters.filter(input=>!input.internal));
  const properties = new Map<string, { label: string; properties: readonly string[] }>();
  for (const input of inputs) {
    const previous = properties.get(input.property), label = input.freedom?.label ?? input.label;
    if (!previous) properties.set(input.property, { label, properties: [input.property] });
    else if (!previous.label.split(' / ').includes(label)) previous.label += ` / ${label}`;
    const vector = input.freedom?.vector;
    if (vector) properties.set(vector.id, { label: vector.label, properties: [...new Set(inputs.filter(other => other.freedom?.vector?.id === vector.id).map(other => other.property))] });
  }
  return [...properties].filter(([, degree]) => !existing.some(action => action.adjusts?.length === degree.properties.length && degree.properties.every(property => action.adjusts!.includes(property))))
    .map(([property, degree]) => ({
      id: `omnic.dof.${property}` as const, owner: 'omnicDegrees' as const,
      scope: 'composerDegree' as const, category: 'Omnic Composer',
      label: degree.label, degreeProperty: property, configurationTrigger: 'repeat' as const,
      defaultKey: '', description: `Open ${degree.label} for the active Composer target. Press again while it is active to configure it. Modifier combinations are assignable; unsupported targets leave it inactive.`,
    }));
}
/** Resolve the fresh writable target capability, including individual vector axes. */
export function commandDegree(degrees: readonly EditableDegree[], property: string): EditableDegree | undefined {
  return degrees.flatMap(degree => [degree, ...(degree.axes ?? [])]).find(degree => degree.id === property || degree.properties.length === 1 && degree.properties[0] === property);
}
export function repeatedDegree(degree: EditableDegree, active: EditableDegree | undefined) {
  return !!active && degree.properties.length === active.properties.length && degree.properties.every(property => active.properties.includes(property)) && degree.targets.length === active.targets.length && degree.targets.every((target, i) => target.id === active.targets[i].id && target.input.property === active.targets[i].input.property);
}
