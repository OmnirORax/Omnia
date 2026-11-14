/** Shared semantic classification for discovery and hierarchy generation. */
export type VisualRole = "text" | "background" | "contour" | "icon" | "indicator";
export function roleFor(target: { binding?: { role?: VisualRole; selection?: { role: string }; text?: boolean; animation?: { kind: string }; css?: string } }): VisualRole | undefined {
  if (target.binding?.role) return target.binding.role;
  if (target.binding?.selection) return target.binding.selection.role as VisualRole;
  if (target.binding?.text || target.binding?.animation?.kind === "text") return "text";
  if (target.binding?.animation?.kind === "icons") return "icon";
  return ({ "background-color": "background", "border-color": "contour", "accent-color": "indicator", "color": "indicator" } as Record<string, VisualRole>)[target.binding?.css ?? ""];
}
