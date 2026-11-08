import { closeContainer, getContainer, ownerOf, type UILayout } from './layout.ts';
import { selectionResident } from './selection.ts';

/** Hide UI residents without removing their functions, contents or placement. */
export function removeUISelection(layout: UILayout, ids: Iterable<string>): UILayout {
  let next = layout;
  for (const id of ids) {
    const key = selectionResident(id);
    if (key.startsWith('function:')) {
      const item = next.items[id];
      next = { ...next, items: { ...next.items, [id]: { ...item, x: item?.x ?? 0, y: item?.y ?? 0, home: item?.home ?? !ownerOf(next, key), hidden: true } } };
    } else if (getContainer(next, key)) next = closeContainer(next, key);
  }
  return next;
}
export function restoreUIFunction(layout: UILayout, id: string): UILayout {
  const item = layout.items[id];
  if (!item?.hidden) return layout;
  return { ...layout, items: { ...layout.items, [id]: { ...item, hidden: false } } };
}
