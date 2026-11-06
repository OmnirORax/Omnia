import { DEFAULT_NODE_CELL_SIZE } from "./assets.ts";
/** Full labels wrap at word boundaries; long words split without losing characters. */
export function labelLines(value: string, columns = 32): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
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
  return lines;
}
export function labelSize(value: string) {
  if (!value.trim()) return { width: 0, height: 0 };
  const lines = labelLines(value);
  return {
    width: Math.max(1.05, ...lines.map((line) => Array.from(line).length * 0.19 + 0.4)),
    height: lines.length * 0.4 + 0.2,
  };
}
/** Default materialization uses uniform cells, independent of content. */
export function defaultNodeOffset(_parent: string, _child: string, index = 0) {
  return { x: DEFAULT_NODE_CELL_SIZE + 0.35, y: index ? -(index % 4) * 2 : 0, z: Math.floor(index / 4) * 2 };
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

/** Place independent presentation rectangles within a view without moving carriers.
 * Bounded candidate search keeps dense views responsive; oversized content retains its size. */
export function arrangeExpansions(items: ScreenLabel[], width: number, height: number, gap = 8) {
  const result = new Map<string, {x:number;y:number}>(), bins = new Map<string, ScreenLabel[]>();
  const binSize = Math.max(64, width / 16, height / 16);
  const keys = (r:ScreenLabel) => {
    const found:string[]=[];
    const left=Math.max(0,Math.floor((r.x-r.width/2-gap)/binSize)),right=Math.min(Math.ceil(width/binSize),Math.floor((r.x+r.width/2+gap)/binSize));
    const top=Math.max(0,Math.floor((r.y-r.height/2-gap)/binSize)),bottom=Math.min(Math.ceil(height/binSize),Math.floor((r.y+r.height/2+gap)/binSize));
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++)found.push(`${x}:${y}`);
    return found;
  };
  for (const item of items) {
    const clamp = (x:number,y:number) => ({x:Math.max(item.width/2,Math.min(width-item.width/2,x)),y:Math.max(item.height/2,Math.min(height-item.height/2,y))});
    const candidates = [clamp(item.x,item.y)];
    for (let ring=1;ring<=12;ring++) for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) candidates.push(clamp(item.x+dx*ring*(item.width+gap),item.y+dy*ring*(item.height+gap)));
    const overlap=(p:{x:number;y:number}) => keys({...item,...p}).some(key=>(bins.get(key)??[]).some(b=>Math.abs(p.x-b.x)<(item.width+b.width)/2+gap&&Math.abs(p.y-b.y)<(item.height+b.height)/2+gap));
    candidates.sort((a,b)=>Math.hypot(a.x-item.x,a.y-item.y)-Math.hypot(b.x-item.x,b.y-item.y));
    const point=candidates.find(p=>!overlap(p))??candidates[0];
    result.set(item.id,point);
    const box={...item,...point};for(const key of keys(box)){const bin=bins.get(key)??[];bin.push(box);bins.set(key,bin);}
  }
  return result;
}
