export function ShortcutHint({ binding }: { binding?: string }) {
  if (!binding) return null;
  const label = binding.replace(/ArrowLeft/g, "←").replace(/ArrowRight/g, "→").replace(/ArrowUp/g, "↑").replace(/ArrowDown/g, "↓");
  return <small className="ui-shortcut-label" aria-hidden="true">({label})</small>;
}
