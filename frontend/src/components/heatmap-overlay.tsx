'use client';

import React, { useEffect, useRef } from 'react';

interface HeatmapOverlayProps {
  points: { x: number, y: number, intensity: number }[];
  type?: 'click' | 'move';
  width: number; // Total width to render
  height: number; // Total height to render
  totalWidth?: number; // Total logical width (for normalization)
  totalHeight?: number; // Total logical height (for normalization)
  scrollTop?: number;
  scrollLeft?: number;
  opacity?: number;
}

export default function HeatmapOverlay({ 
  points, 
  type = 'click', 
  width, 
  height, 
  totalWidth,
  totalHeight,
  scrollTop = 0, 
  scrollLeft = 0,
  opacity = 0.7
}: HeatmapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, width, height);

    if (points.length === 0) return;

    // Use a simpler rendering path for performance
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = width;
    heatCanvas.height = height;
    const hctx = heatCanvas.getContext('2d');
    if (!hctx) return;

    // Heat settings
    const radius = type === 'click' ? 18 : 30;
    
    // Create a radial gradient brush once
    const brush = document.createElement('canvas');
    brush.width = radius * 2;
    brush.height = radius * 2;
    const bctx = brush.getContext('2d');
    if (bctx) {
        const grd = bctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
        grd.addColorStop(0, 'rgba(0,0,0,1)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        bctx.fillStyle = grd;
        bctx.fillRect(0, 0, radius * 2, radius * 2);
    }

    // Draw all points to the heat canvas
    points.forEach(point => {
      // De-normalize from 1000 range to TOTAL page dimensions
      // If totalWidth is provided, use it for normalization ratio, else assume point.x is relative to width
      const absoluteX = totalWidth ? (point.x / 1000) * totalWidth : (point.x / 1000) * width;
      const absoluteY = totalHeight ? (point.y / 1000) * totalHeight : (point.y / 1000) * height;
      
      const x = absoluteX - scrollLeft;
      const y = absoluteY - scrollTop;

      // Visibility check
      if (x < -radius || x > width + radius || y < -radius || y > height + radius) return;
      
      const intensity = Math.min(1, point.intensity / (type === 'click' ? 10 : 30));
      hctx.globalAlpha = intensity * 0.4;
      hctx.drawImage(brush, x - radius, y - radius);
    });

    // Colorize using a gradient lookup table
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 1;
    gradientCanvas.height = 256;
    const gctx = gradientCanvas.getContext('2d');
    if (gctx) {
        const grd = gctx.createLinearGradient(0, 0, 0, 256);
        grd.addColorStop(0, 'rgba(0, 0, 255, 0)');     // Transparent blue
        grd.addColorStop(0.25, 'rgba(0, 255, 255, 0.5)'); // Cyan
        grd.addColorStop(0.5, 'rgba(0, 255, 0, 0.6)');    // Green
        grd.addColorStop(0.75, 'rgba(255, 255, 0, 0.7)'); // Yellow
        grd.addColorStop(1, 'rgba(255, 0, 0, 0.8)');    // Red
        gctx.fillStyle = grd;
        gctx.fillRect(0, 0, 1, 256);
    }
    const gradientData = gctx?.getImageData(0, 0, 1, 256).data;

    // Apply color to the viewport canvas
    const imgData = hctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    if (gradientData) {
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                const offset = alpha * 4;
                data[i] = gradientData[offset];
                data[i + 1] = gradientData[offset + 1];
                data[i + 2] = gradientData[offset + 2];
                // Apply global opacity here
                data[i + 3] = alpha * opacity;
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // Optional: Draw small indicator for high intensity points in click map
    if (type === 'click') {
        points.forEach(point => {
            if (point.intensity < 20) return;
            const absoluteX = totalWidth ? (point.x / 1000) * totalWidth : (point.x / 1000) * width;
            const absoluteY = totalHeight ? (point.y / 1000) * totalHeight : (point.y / 1000) * height;
            const x = absoluteX - scrollLeft;
            const y = absoluteY - scrollTop;
            
            if (x >= 0 && x <= width && y >= 0 && y <= height) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }

  }, [points, type, width, height, totalWidth, totalHeight, scrollTop, scrollLeft, opacity]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="absolute top-0 left-0 pointer-events-none z-10"
    />
  );
}
