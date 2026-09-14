/**
 * Canvas painting for click and scroll heatmaps.
 *
 * Takes a canvas and the points and draws — no React, no data fetching. Keeping it
 * separate from the viewer means the rendering can be exercised against a fixed set of
 * points, and the same painter can serve a preview, an export or a thumbnail.
 */
import type { HeatPoint } from './preview-math';

export function drawClickHeatmap(canvas: HTMLCanvasElement, points: HeatPoint[], w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!points.length) return;

  // Offscreen canvas for intensity pass
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d')!;
  octx.globalCompositeOperation = 'lighter';

  const maxI = Math.max(...points.map(p => p.intensity), 1);
  // Tight spots: radius scales with canvas size only — not intensity (high counts were “bomb” sized).
  const ref  = Math.min(w, h);
  const rSpot = Math.max(4, Math.min(22, ref * 0.014));

  for (const p of points) {
    const cx = Math.min(w, Math.max(0, p.nx * w));
    const cy = Math.min(h, Math.max(0, p.ny * h));
    const norm = p.intensity / maxI;
    const alpha = 0.055 + Math.sqrt(norm) * 0.34;

    const g = octx.createRadialGradient(cx, cy, 0, cx, cy, rSpot);
    g.addColorStop(0,   `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.25})`);
    g.addColorStop(1,   'rgba(255,255,255,0)');
    octx.beginPath();
    octx.arc(cx, cy, rSpot, 0, Math.PI * 2);
    octx.fillStyle = g;
    octx.fill();
  }

  // Colour ramp: transparent → blue → cyan → green → yellow → orange → red
  const ramp: [number, [number, number, number, number]][] = [
    [0,   [  0,   0,   0,   0]],
    [20,  [  0,  50, 255,  40]],
    [70,  [  0, 180, 255, 130]],
    [120, [  0, 255, 180, 190]],
    [170, [100, 255,   0, 210]],
    [210, [255, 230,   0, 230]],
    [240, [255, 100,   0, 245]],
    [255, [255,   0,   0, 255]],
  ];

  const imgData = octx.getImageData(0, 0, w, h);
  const px = imgData.data;

  for (let i = 0; i < px.length; i += 4) {
    const v = px[i + 3];
    if (v === 0) continue;
    const c = rampAt(ramp, Math.min(v, 255));
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  }

  ctx.putImageData(imgData, 0, 0);
}

// Draw scroll-depth heatmap: horizontal translucent bands at each depth milestone.
export function drawScrollHeatmap(canvas: HTMLCanvasElement, points: HeatPoint[], w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!points.length) return;

  const maxI = Math.max(...points.map(p => p.intensity), 1);

  // Sort by ny ascending (top to bottom)
  const sorted = [...points].sort((a, b) => a.ny - b.ny);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const yPx = p.ny * h;
    const norm = p.intensity / maxI;

    // Gradient fill from previous depth to this one
    const prevY = i === 0 ? 0 : sorted[i - 1].ny * h;
    const bandH = yPx - prevY;
    if (bandH > 0) {
      const alpha = 0.06 + norm * 0.2;
      // warm at top (high coverage), cool at bottom
      const heat = 1 - p.ny; // 1 at top, 0 at bottom
      const r = Math.round(heat * 200 + 50);
      const g = Math.round((1 - heat) * 200 + 50);
      const b = Math.round((1 - heat) * 255);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(0, prevY, w, bandH);
    }

    // Horizontal fold line
    const lineAlpha = 0.25 + norm * 0.55;
    const heat2 = 1 - p.ny;
    const lr = Math.round(heat2 * 230 + 20);
    const lg = Math.round((1 - heat2) * 230 + 20);
    const lb = Math.round((1 - heat2) * 255);
    ctx.beginPath();
    ctx.moveTo(0, yPx);
    ctx.lineTo(w, yPx);
    ctx.strokeStyle = `rgba(${lr},${lg},${lb},${lineAlpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Depth label
    const pctLabel = `${Math.round(p.ny * 100)}% — ${p.intensity.toLocaleString()} users`;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = `rgba(255,255,255,0.75)`;
    ctx.fillText(pctLabel, 8, yPx - 5);
  }
}

export function rampAt(ramp: [number, [number, number, number, number]][], v: number): [number, number, number, number] {
  for (let i = 1; i < ramp.length; i++) {
    if (v <= ramp[i][0]) {
      const [v0, c0] = ramp[i - 1];
      const [v1, c1] = ramp[i];
      const t = (v - v0) / (v1 - v0);
      return c0.map((c, idx) => Math.round(c + (c1[idx] - c) * t)) as [number, number, number, number];
    }
  }
  return ramp[ramp.length - 1][1];
}

/** Neutral underlay when the live page cannot be embedded (faster + clearer than a page wireframe). */
