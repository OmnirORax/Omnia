/** Small reusable, seamless electric ink tile. Glyph masks clip it to actual lettering. */
export function createElectricInk() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  let previous = "";
  const random = (n: number) => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
  return {
    canvas,
    update(seconds: number, density: number, length = 0.35) {
      const frame = Math.floor(seconds * 18), key = `${frame}:${density}:${length}`;
      if (key === previous) return false; previous = key;
      context.fillStyle = "#303030"; context.fillRect(0, 0, 128, 128);
      context.lineJoin = "round"; context.lineCap = "round";
      const count = 6 + Math.ceil(density * 16);
      for (let i = 0; i < count; i++) {
        const seed = i * 17.3, drift = seconds * (8 + random(seed) * 12), x = (random(seed) * 128 + drift) % 128;
        const start = random(seed + 2) * 128, extent = 22 + length * 90;
        context.beginPath();
        for (let j = 0; j < 13; j++) {
          const px = x + (random(frame + seed + j * 7.1) - 0.5) * 13;
          const py = start + j / 12 * extent;
          // Repeat both edges so the GPU/UI pattern wraps without a hard seam.
          for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) {
            if (j) {
              const priorX = x + (random(frame + seed + (j - 1) * 7.1) - 0.5) * 13;
              context.moveTo(priorX + dx, start + (j - 1) / 12 * extent + dy); context.lineTo(px + dx, py + dy);
            }
          }
        }
        const strength = 0.45 + random(seed + Math.floor(frame / 2)) * 0.55;
        context.strokeStyle = `rgba(210,210,210,${strength * 0.28})`; context.lineWidth = 8; context.stroke();
        context.strokeStyle = `rgba(240,240,240,${strength * 0.65})`; context.lineWidth = 2.5; context.stroke();
        context.strokeStyle = `rgba(255,255,255,${strength})`; context.lineWidth = 0.7; context.stroke();
      }
      return true;
    },
  };
}
