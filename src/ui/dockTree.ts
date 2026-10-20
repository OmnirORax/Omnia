/** Presentation only. Frame membership remains the authority for ownership. */
export type DockSide = "left" | "right" | "top" | "bottom" | "tab";
export type DockNode =
  | { kind: "tabs"; keys: string[]; active: string }
  | { kind: "split"; axis: "horizontal" | "vertical"; ratio: number; first: DockNode; second: DockNode };

export const dockKeys = (node?: DockNode): string[] => !node ? [] : node.kind === "tabs"
  ? node.keys : [...dockKeys(node.first), ...dockKeys(node.second)];
export const dockTabs = (key: string): DockNode => ({ kind: "tabs", keys: [key], active: key });
export function removeDockKey(node: DockNode | undefined, key: string): DockNode | undefined {
  if (!node) return;
  if (node.kind === "tabs") {
    const keys = node.keys.filter(item => item !== key);
    return keys.length ? { ...node, keys, active: keys.includes(node.active) ? node.active : keys[0] } : undefined;
  }
  const first = removeDockKey(node.first, key), second = removeDockKey(node.second, key);
  return first && second ? { ...node, first, second } : first ?? second;
}
export function insertDockKey(node: DockNode, target: string, key: string, side: DockSide): DockNode {
  if (node.kind === "split") return {
    ...node,
    first: insertDockKey(node.first, target, key, side),
    second: insertDockKey(node.second, target, key, side),
  };
  if (!node.keys.includes(target)) return node;
  if (side === "tab") return { ...node, keys: [...node.keys, key], active: key };
  const before = side === "left" || side === "top";
  return { kind: "split", axis: side === "left" || side === "right" ? "horizontal" : "vertical", ratio: 0.5,
    first: before ? dockTabs(key) : node, second: before ? node : dockTabs(key) };
}
export function updateDockNode(node: DockNode, path: number[], change: (node: DockNode) => DockNode): DockNode {
  if (!path.length) return change(node);
  if (node.kind !== "split") return node;
  const [side, ...rest] = path;
  return side === 0 ? { ...node, first: updateDockNode(node.first, rest, change) }
    : { ...node, second: updateDockNode(node.second, rest, change) };
}
export function validateDockNode(node: unknown, members: Set<string>, depth = 0, seen = new Set<string>()): void {
  if (!node || typeof node !== "object" || depth > 16) throw new Error("Invalid dock layout.");
  const value = node as DockNode;
  if (value.kind === "tabs") {
    if (!Array.isArray(value.keys) || !value.keys.length || value.keys.length > 500 || !value.keys.includes(value.active))
      throw new Error("Invalid dock tabs.");
    for (const key of value.keys) {
      if (typeof key !== "string" || !/^(frame|window):/.test(key) || !members.has(key) || seen.has(key))
        throw new Error("Invalid or duplicate dock member.");
      seen.add(key);
    }
  } else if (value.kind === "split") {
    if (!["horizontal", "vertical"].includes(value.axis) || !Number.isFinite(value.ratio) || value.ratio < 0.1 || value.ratio > 0.9)
      throw new Error("Invalid dock split.");
    validateDockNode(value.first, members, depth + 1, seen);
    validateDockNode(value.second, members, depth + 1, seen);
  } else throw new Error("Invalid dock layout kind.");
  if (depth === 0 && seen.size !== members.size) throw new Error("Every dock member must appear exactly once.");
}
