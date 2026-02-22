'use client';

import React, { useEffect, useRef } from 'react';

interface HeatmapOverlayProps {
  points: { x: number; y: number; intensity: number }[];
  type?: 'click' | 'move' | 'scroll' | 'rage_click' | 'dead_click';
  width: number;
  height: number;
  totalWidth?: number;
  totalHeight?: number;
  opacity?: number;
}

export default function HeatmapOverlay({
  points,
  type = 'click',
  width,
  height,
  totalWidth,
  totalHeight,
  opacity = 0.6
}: HeatmapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // More refined, enterprise-grade gradient (blue → cyan → green → yellow → red)
  const gradientColors: Record<number, string> = {
    0.0: '#3b82f6',   // blue-500
    0.15: '#22d3ee',   // cyan-400
    0.35: '#a3e635',   // lime-400
    0.55: '#facc15',   // yellow-400
    0.75: '#f97316',   // orange-500
    1.0: '#ef4444',    // red-500
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    if (points.length === 0) return;

    // === SCROLL HEATMAP: Hotjar-style colored bands with visitor % labels ===
    if (type === 'scroll') {
      // Points have y = 0-1000 (normalized scroll depth bands, 50-unit increments)
      // Group by y band and find the top-of-page intensity (= total visitors)
      const bandMap: Record<number, number> = {};
      let maxIntensity = 1;
      points.forEach(p => {
        const band = Math.round(p.y);
        bandMap[band] = (bandMap[band] || 0) + p.intensity;
        if (bandMap[band] > maxIntensity) maxIntensity = bandMap[band];
      });

      // The top band (0) represents ~100% of visitors; each deeper band is relative to it
      const topIntensity = bandMap[0] || maxIntensity;

      // Build palette
      const paletteCanvas = document.createElement('canvas');
      paletteCanvas.width = 1;
      paletteCanvas.height = 256;
      const paletteCtx = paletteCanvas.getContext('2d');
      if (!paletteCtx) return;

      const grd = paletteCtx.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0.0, '#ef4444');
      grd.addColorStop(0.25, '#f97316');
      grd.addColorStop(0.5, '#facc15');
      grd.addColorStop(0.75, '#a3e635');
      grd.addColorStop(1.0, '#3b82f6');
      paletteCtx.fillStyle = grd;
      paletteCtx.fillRect(0, 0, 1, 256);
      const paletteData = paletteCtx.getImageData(0, 0, 1, 256).data;

      // Draw colored bands
      const bandStep = 50;
      const bandHeightPx = (bandStep / 1000) * height;

      for (let band = 0; band <= 1000; band += bandStep) {
        const intensity = bandMap[band] || 0;
        if (intensity === 0) continue;

        const ratio = intensity / maxIntensity;
        const colorIdx = Math.min(255, Math.floor((1 - ratio) * 255));
        const offset = colorIdx * 4;

        const r = paletteData[offset];
        const g = paletteData[offset + 1];
        const b = paletteData[offset + 2];
        const bandY = (band / 1000) * height;

        ctx.globalAlpha = 0.35 + ratio * 0.45;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, bandY, width, bandHeightPx + 1);
      }

      // === Draw Hotjar-style visitor % labels at key scroll depths ===
      ctx.globalAlpha = 1;

      // Helper: draw a pill-shaped label with background
      const drawScrollLabel = (yPos: number, visitorPct: number, depthPct: number) => {
        const label = `${visitorPct}% of visitors`;
        const depthLabel = `${depthPct}% of page`;

        // Solid line across the full width
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(width, yPos);
        ctx.stroke();

        // Pill background for the visitor label (left side)
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
        const mainText = ctx.measureText(label);
        const pillW = mainText.width + 16;
        const pillH = 24;
        const pillX = 8;
        const pillY = yPos - pillH / 2;

        // Rounded rectangle pill
        const pillRadius = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath();
        ctx.moveTo(pillX + pillRadius, pillY);
        ctx.lineTo(pillX + pillW - pillRadius, pillY);
        ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillRadius);
        ctx.lineTo(pillX + pillW, pillY + pillH - pillRadius);
        ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillRadius, pillY + pillH);
        ctx.lineTo(pillX + pillRadius, pillY + pillH);
        ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillRadius);
        ctx.lineTo(pillX, pillY + pillRadius);
        ctx.quadraticCurveTo(pillX, pillY, pillX + pillRadius, pillY);
        ctx.closePath();
        ctx.fill();

        // Visitor % text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, pillX + 8, yPos + 4);

        // Depth label on the right side (lighter pill)
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        const depthText = ctx.measureText(depthLabel);
        const depthPillW = depthText.width + 12;
        const depthPillX = width - depthPillW - 8;
        const depthPillY = yPos - 10;
        const depthPillH = 20;

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(depthPillX + pillRadius, depthPillY);
        ctx.lineTo(depthPillX + depthPillW - pillRadius, depthPillY);
        ctx.quadraticCurveTo(depthPillX + depthPillW, depthPillY, depthPillX + depthPillW, depthPillY + pillRadius);
        ctx.lineTo(depthPillX + depthPillW, depthPillY + depthPillH - pillRadius);
        ctx.quadraticCurveTo(depthPillX + depthPillW, depthPillY + depthPillH, depthPillX + depthPillW - pillRadius, depthPillY + depthPillH);
        ctx.lineTo(depthPillX + pillRadius, depthPillY + depthPillH);
        ctx.quadraticCurveTo(depthPillX, depthPillY + depthPillH, depthPillX, depthPillY + depthPillH - pillRadius);
        ctx.lineTo(depthPillX, depthPillY + pillRadius);
        ctx.quadraticCurveTo(depthPillX, depthPillY, depthPillX + pillRadius, depthPillY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillText(depthLabel, depthPillX + 6, yPos + 3);
      };

      // Draw labels at every 20% of page depth
      for (let depthPct = 0; depthPct <= 100; depthPct += 20) {
        const band = depthPct * 10;
        const intensity = bandMap[band] || 0;
        const visitorPct = topIntensity > 0 ? Math.round((intensity / topIntensity) * 100) : 0;
        const yPos = (band / 1000) * height;

        // Skip if the label would be too close to the top edge
        if (yPos < 14 && depthPct === 0) {
          drawScrollLabel(yPos + 14, 100, 0);
        } else {
          drawScrollLabel(yPos, visitorPct, depthPct);
        }
      }

      // === "Average fold" indicator ===
      // Estimate average fold as ~the viewport height relative to the full page
      // We'll place it approximately where the first significant drop-off occurs
      // For simplicity, find where visitors drop below 80%
      let foldBand = 0;
      for (let band = 0; band <= 1000; band += 50) {
        const intensity = bandMap[band] || 0;
        const pct = topIntensity > 0 ? (intensity / topIntensity) * 100 : 0;
        if (pct < 80 && band > 0) {
          foldBand = band;
          break;
        }
      }

      if (foldBand > 0) {
        const foldY = (foldBand / 1000) * height;
        // Dashed line for the fold
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(0, foldY);
        ctx.lineTo(width, foldY);
        ctx.stroke();
        ctx.setLineDash([]);

        // "Average fold" label
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        const foldLabel = 'AVERAGE FOLD';
        const foldTextW = ctx.measureText(foldLabel).width;
        const foldPillW = foldTextW + 14;
        const foldPillX = width / 2 - foldPillW / 2;
        const foldPillY = foldY - 12;

        ctx.fillStyle = '#ef4444';
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(foldPillX + r, foldPillY);
        ctx.lineTo(foldPillX + foldPillW - r, foldPillY);
        ctx.quadraticCurveTo(foldPillX + foldPillW, foldPillY, foldPillX + foldPillW, foldPillY + r);
        ctx.lineTo(foldPillX + foldPillW, foldPillY + 20 - r);
        ctx.quadraticCurveTo(foldPillX + foldPillW, foldPillY + 20, foldPillX + foldPillW - r, foldPillY + 20);
        ctx.lineTo(foldPillX + r, foldPillY + 20);
        ctx.quadraticCurveTo(foldPillX, foldPillY + 20, foldPillX, foldPillY + 20 - r);
        ctx.lineTo(foldPillX, foldPillY + r);
        ctx.quadraticCurveTo(foldPillX, foldPillY, foldPillX + r, foldPillY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(foldLabel, foldPillX + 7, foldPillY + 14);
      }

      return;
    }

    // === POINT-BASED HEATMAPS (click, move, rage_click, dead_click) ===
    const radius = type === 'move' ? 34 : 18;

    // Draw density map as grayscale alpha
    points.forEach(point => {
      // X is normalized 0-1000 (percentage of body width) — scale to canvas width
      const x = totalWidth ? (point.x / 1000) * totalWidth : (point.x / 1000) * width;
      // Y is absolute pixels from the tracker (e.pageY) — use directly as-is
      const y = point.y;

      if (isNaN(x) || isNaN(y)) return;

      const alpha = Math.min(1, Math.max(0.08, point.intensity / 6));
      ctx.globalAlpha = alpha;

      const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.6, 'rgba(0,0,0,0.4)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grd;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });

    // Colorize using gradient palette: use physical pixels, not logical width/height
    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = currentImageData.data;

    const paletteCanvas = document.createElement('canvas');
    paletteCanvas.width = 1;
    paletteCanvas.height = 256;
    const paletteCtx = paletteCanvas.getContext('2d');

    if (paletteCtx) {
      const grd = paletteCtx.createLinearGradient(0, 0, 0, 256);

      // Use red/orange palette for rage clicks, gray/blue for dead clicks
      const colors = type === 'rage_click'
        ? { 0.0: '#fbbf24', 0.3: '#f97316', 0.6: '#ef4444', 1.0: '#dc2626' }
        : type === 'dead_click'
        ? { 0.0: '#94a3b8', 0.3: '#64748b', 0.6: '#475569', 1.0: '#334155' }
        : gradientColors;

      Object.entries(colors).forEach(([stop, color]) => {
        grd.addColorStop(parseFloat(stop), color);
      });
      paletteCtx.fillStyle = grd;
      paletteCtx.fillRect(0, 0, 1, 256);

      const paletteData = paletteCtx.getImageData(0, 0, 1, 256).data;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          const offset = alpha * 4;
          data[i] = paletteData[offset];
          data[i + 1] = paletteData[offset + 1];
          data[i + 2] = paletteData[offset + 2];
          data[i + 3] = Math.min(255, alpha * 2);
        }
      }

      ctx.putImageData(currentImageData, 0, 0);
    }
  }, [points, type, width, height, totalWidth, totalHeight]);

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none z-10 overflow-hidden"
      style={{ width: `${width}px`, height: `${height}px`, opacity }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
      />
    </div>
  );
}
