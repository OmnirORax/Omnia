/** Full labels wrap at word boundaries; long words split without losing characters. */
export function labelLines(value: string, columns = 32): string[] {
  const lines: string[] = [];
  for (const paragraph of (value || "Untitled").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const chunks = Array.from(word);
      if (line && Array.from(line).length + chunks.length + 1 > columns) {
        lines.push(line);
        line = "";
      }
      while (chunks.length > columns) lines.push(chunks.splice(0, columns).join(""));
      if (chunks.length) line = line ? `${line} ${chunks.join("")}` : chunks.join("");
    }
    lines.push(line);
  }
  return lines.length ? lines : ["Untitled"];
}
export function labelSize(value: string) {
  const lines = labelLines(value);
  return {
    width: Math.max(1.05, ...lines.map((line) => Array.from(line).length * 0.19 + 0.4)),
    height: lines.length * 0.4 + 0.2,
  };
}
/** Clear binder run approximately as wide as a long name, growing only for real content. */
export function defaultNodeOffset(parent: string, child: string, index = 0) {
  return { x: labelSize(parent).width / 2 + labelSize(child).width / 2 + 5.5, y: index ? -(index % 4) * 2 : 0, z: Math.floor(index / 4) * 2 };
}
export type ScreenLabel = { id: string; x: number; y: number; width: number; height: number };
/** Stable sideways displacement of visible text rectangles, with a real gap. */
export function separateLabels(items: ScreenLabel[], gap = 12): Map<string, number> {
  const placed: ScreenLabel[] = [],
    offsets = new Map<string, number>();
  for (const item of items) {
    const obstacles = placed.filter(
      (p) => Math.abs(p.y - item.y) < (p.height + item.height) / 2 + gap,
    );
    const candidates = [
      0,
      ...obstacles.flatMap((p) => [
        p.x + (p.width + item.width) / 2 + gap - item.x,
        p.x - (p.width + item.width) / 2 - gap - item.x,
      ]),
    ];
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
    const offset =
      candidates.find((x) =>
        obstacles.every(
          (p) => Math.abs(p.x - item.x - x) >= (p.width + item.width) / 2 + gap - 1e-6,
        ),
      ) ?? 0;
    offsets.set(item.id, offset);
    placed.push({ ...item, x: item.x + offset });
  }
  return offsets;
}
