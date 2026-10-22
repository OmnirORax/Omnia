const registered = new Set<string>();

/** Shared native paint animation adapter; feedback variables are never saved properties. */
export function registerPaintVariable(name: string, syntax: string, inherits: boolean, initial?: string): boolean {
  if (registered.has(name)) return true;
  if (!CSS.registerProperty) return false;
  const initialValue = initial ?? (syntax === "<color>" ? "transparent" : syntax === "<length>" ? "0px" : syntax === "<percentage>" ? "0%" : "0");
  try { CSS.registerProperty({ name, syntax, inherits, initialValue }); }
  catch (error) { if (!(error instanceof DOMException) || error.name !== "InvalidModificationError") return false; }
  registered.add(name);
  return true;
}
