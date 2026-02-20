'use client';

import React, { useEffect, useRef } from 'react';

interface HeatmapOverlayProps {
  points: { x: number; y: number; intensity: number }[];
  type?: 'click' | 'move';
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

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (points.length === 0) return;

    // Config: click points are tighter, movement is broader
    const radius = type === 'click' ? 28 : 44;

    // Draw density map as grayscale alpha
    points.forEach(point => {
      const x = Math.round(totalWidth ? (point.x / 1000) * totalWidth : (point.x / 1000) * width);
      const y = Math.round(totalHeight ? (point.y / 1000) * totalHeight : (point.y / 1000) * height);

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

    // Colorize using gradient palette
    const currentImageData = ctx.getImageData(0, 0, width, height);
    const data = currentImageData.data;

    const paletteCanvas = document.createElement('canvas');
    paletteCanvas.width = 1;
    paletteCanvas.height = 256;
    const paletteCtx = paletteCanvas.getContext('2d');

    if (paletteCtx) {
      const grd = paletteCtx.createLinearGradient(0, 0, 0, 256);
      Object.entries(gradientColors).forEach(([stop, color]) => {
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
