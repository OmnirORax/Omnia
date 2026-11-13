import type { Property, Value } from '../properties/pool.ts';
export function field(property: Property, value: Value) {
  const row = document.createElement('label'), caption = document.createElement('span'); caption.textContent = property.label;
  const input = property.kind === 'select' ? document.createElement('select') : document.createElement('input');
  if (input instanceof HTMLSelectElement) {
    for (const choice of property.options ?? []) { const option = document.createElement('option'); option.value = choice.id; option.textContent = choice.label; input.append(option); }
  } else {
    input.type = property.kind === 'toggle' ? 'checkbox' : property.kind === 'number' && property.presentation === 'slider' ? 'range' : property.kind;
    if (property.kind === 'toggle') input.checked = Boolean(value);
    if (property.kind === 'number') { input.step = String(property.step ?? 'any'); if (property.min !== undefined) input.min = String(property.min); if (property.max !== undefined) input.max = String(property.max); input.required = true; }
  }
  input.value = String(value); input.setAttribute('aria-label', property.label); row.append(caption, input);
  return { row, input, value: (): Value => property.kind === 'toggle' ? (input as HTMLInputElement).checked : property.kind === 'number' ? Number(input.value) : input.value };
}
