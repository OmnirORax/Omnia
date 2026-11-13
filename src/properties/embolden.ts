/** Synthetic stroke expansion for text, independent of the font's built-in weights.
 * Amount 0 is unchanged; 10 is deliberately extreme (0.25em wide outline).
 * UI and 3D glyphs share the same scale relative to their font size. */
export function emboldenStrokeEm(amount = 0): number {
  return Math.max(0, Math.min(10, amount)) / 40;
}

/** Stroke first, fill second, preserving the glyph interior and a single glow pass.
 * This operates on the already-selected typeface, including imported OTF/TTF faces. */
export function drawEmboldenedText(
  context: CanvasRenderingContext2D,
  caption: string,
  x: number,
  y: number,
  amount = 0,
  fontSize = 32,
): void {
  const width = emboldenStrokeEm(amount) * fontSize;
  if (width > 0) {
    context.save();
    context.lineWidth = width;
    context.lineJoin = 'round';
    context.strokeStyle = context.fillStyle;
    context.shadowBlur = 0;
    context.strokeText(caption, x, y);
    context.restore();
  }
  context.fillText(caption, x, y);
}
