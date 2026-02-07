'use client';

import React, { useEffect, useRef } from 'react';

interface HeatmapOverlayProps {
  points: { x: number, y: number, intensity: number }[];
  type: 'click' | 'move';
  width: number; // Viewport width
  height: number; // Viewport height
  totalWidth: number; // Total page width
  totalHeight: number; // Total page height
  scrollTop?: number;
  scrollLeft?: number;
}

export default function HeatmapOverlay({ 
  points, 
  type, 
  width, 
  height, 
  totalWidth,
  totalHeight,
  scrollTop = 0, 
  scrollLeft = 0 
}: HeatmapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, width, height);

    // Use a simpler rendering path for performance during scroll
    // 1. Create a transient canvas for the grayscale 'heat'
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = width;
    heatCanvas.height = height;
    const hctx = heatCanvas.getContext('2d');
    if (!hctx) return;

    // Heat settings
    const radius = type === 'click' ? 18 : 30;
    const blur = type === 'click' ? 10 : 15;
    
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
      const absoluteX = (point.x / 1000) * (totalWidth || width);
      const absoluteY = (point.y / 1000) * (totalHeight || height);
      
      const x = absoluteX - (scrollLeft || 0);
      const y = absoluteY - (scrollTop || 0);

      // Visibility check
      if (x < -radius || x > width + radius || y < -radius || y > height + radius) return;
      
      const intensity = Math.min(1, point.intensity / (type === 'click' ? 10 : 30));
      hctx.globalAlpha = intensity * 0.4;
      hctx.drawImage(brush, x - radius, y - radius);
    });

    // 2. Colorize using a gradient lookup table (pre-generated)
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
                // Boost alpha slightly for visibility but keep it dynamic
                data[i + 3] = alpha * 0.9;
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // 3. Optional: Draw small indicator for high intensity points in click map
    if (type === 'click') {
        points.forEach(point => {
            if (point.intensity < 20) return;
            const x = (point.x / 1000) * (totalWidth || width) - (scrollLeft || 0);
            const y = (point.y / 1000) * (totalHeight || height) - (scrollTop || 0);
            
            if (x >= 0 && x <= width && y >= 0 && y <= height) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }

  }, [points, type, width, height, totalWidth, totalHeight, scrollTop, scrollLeft]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="absolute top-0 left-0 pointer-events-none z-10"
    />
  );
}
