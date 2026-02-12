'use client';

import React, { useEffect, useRef } from 'react';

interface HeatmapOverlayProps {
  points: { x: number, y: number, intensity: number }[];
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

  // Gradient configuration
  const gradientColors = {
    0.2: 'blue',
    0.4: 'cyan',
    0.6: 'lime',
    0.8: 'yellow',
    1.0: 'red'
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (points.length === 0) return;

    // 1. Create a grayscale shadow/density map
    // We use the main canvas for this directly to save memory, then colorize it
    
    // Configuration
    const radius = type === 'click' ? 25 : 40;
    const blur = 15;
    
    // Draw points as radial gradients (shadows)
    points.forEach(point => {
        // Normalize coordinates from 1000-based scale to pixels
        // If totalWidth is provided (from tracker), use it. Otherwise assume standard 1200 grid?
        // Actually, x_percent is 0-1000 relative to the ACTUAL page width.
        // So we need to map 0-1000 -> 0-totalWidth
        
        const x = Math.round(totalWidth ? (point.x / 1000) * totalWidth : (point.x / 1000) * width);
        const y = Math.round(totalHeight ? (point.y / 1000) * totalHeight : (point.y / 1000) * height);

        if (isNaN(x) || isNaN(y)) return;

        // Draw radial gradient
        ctx.beginPath();
        const alpha = Math.min(1, Math.max(0.1, point.intensity / 5)); // Heuristic intensity
        ctx.globalAlpha = alpha;
        
        // Simple circle for performance, or gradient for quality?
        // Gradient looks much better for heatmaps
        const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grd.addColorStop(0, "rgba(0,0,0,1)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        
        ctx.fillStyle = grd;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });

    // 2. Colorize the heatmap
    // Get pixel data (grayscale alpha channel effectively)
    const currentImageData = ctx.getImageData(0, 0, width, height);
    const data = currentImageData.data;

    // Create a gradient palette (1px by 256px)
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

        // Map density (alpha/blackness) to color
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3]; // Alpha channel holds the accumulated density
            
            if (alpha > 0) {
                // Map alpha (0-255) to palette index (0-255)
                // We use the alpha value as the index into our gradient palette
                const offset = alpha * 4;
                
                data[i] = paletteData[offset];     // R
                data[i + 1] = paletteData[offset + 1]; // G
                data[i + 2] = paletteData[offset + 2]; // B
                // Keep the alpha, or modulate it
                data[i + 3] = Math.min(255, alpha * 2); // Boost visibility
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
