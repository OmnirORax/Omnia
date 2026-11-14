/** Pure angular quantization shared by evaluation, previews and commands. */
export function rotationStops(text: string): number[] {
  if (!text.trim()) return [];
  const parts = text.split(',');
  if (parts.length > 32 || parts.some(part => !part.trim() || !Number.isFinite(Number(part)) || Math.abs(Number(part)) > 1080))
    throw Error('Angles must be up to 32 comma-separated numbers between -1080 and 1080.');
  return [...new Set(parts.map(Number))].sort((a,b)=>a-b);
}
export function snappedAngle(angle: number, step = 0, origin = 0, stops = ''): number {
  const allowed = rotationStops(stops);
  if (allowed.length) return allowed.reduce((best,value)=>Math.abs(value-angle)<Math.abs(best-angle)?value:best);
  return step > 0 ? Number((origin + Math.round((angle-origin)/step)*step).toFixed(9)) : angle;
}
