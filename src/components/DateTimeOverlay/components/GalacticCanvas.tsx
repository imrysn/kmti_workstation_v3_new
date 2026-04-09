import React, { useEffect, useRef } from 'react';
import { ThemeConfig } from '../types';

interface GalacticCanvasProps {
  theme: ThemeConfig;
  overlayRef: React.RefObject<HTMLDivElement>;
  isInactive: boolean;
}

export const GalacticCanvas: React.FC<GalacticCanvasProps> = ({ theme, overlayRef, isInactive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bhAnimRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (theme.className !== 'theme-galactic') {
      cancelAnimationFrame(bhAnimRef.current);
      return;
    }
    const ctx = canvas.getContext('2d')!;

    // Seed stable stars and particles once
    const particles: { x: number; y: number; s: number; v: number; a: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * 2 * Math.PI,
        y: Math.random() * 50 + 100,
        s: Math.random() * 0.5 + 0.5,
        v: Math.random() * 0.02 + 0.01,
        a: Math.random()
      });
    }

    let t = 0;
    let lastFrameTime = 0;
    const fpsLimit = isInactive ? 15 : 60;
    const frameInterval = 1000 / fpsLimit;

    const draw = (timestamp: number) => {
      // Performance Throttling: Skip frames if inactive
      if (timestamp - lastFrameTime < frameInterval) {
        bhAnimRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = timestamp;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2, cy = H / 2;
      const pillW = overlayRef.current?.offsetWidth || 220;
      const pillH = overlayRef.current?.offsetHeight || 64;
      const bhRx = pillW / 2;
      const bhRy = pillH / 2;

      // Explicit Pill Path Generator
      const drawPillPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
        const r = Math.min(w / 2, h / 2, 32);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
      };

      // 4. THE BLACK HOLE (The Pill)
      drawPillPath(ctx, cx - bhRx, cy - bhRy, pillW, pillH);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // --- NEON ORANGE BORDER ---
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff6600';
      ctx.strokeStyle = '#ffae00';
      ctx.lineWidth = 1.5;
      drawPillPath(ctx, cx - bhRx, cy - bhRy, pillW, pillH);
      ctx.stroke();

      // Secondary Outer Rotating "Plasma Glow"
      ctx.save();
      const offset = 6;
      const oW = pillW + offset * 2;
      const oH = pillH + offset * 2;
      const ox = cx - (oW / 2);
      const oy = cy - (oH / 2);
      const oPerimeter = (oW * 2) + (oH * Math.PI);

      // Layered Glow effect
      // If inactive, skip complex filters to save CPU
      if (!isInactive) {
        ctx.filter = 'blur(12px)';
        ctx.shadowBlur = 45;
        ctx.shadowColor = '#ff4400';
      }
      
      ctx.strokeStyle = `rgba(255, 68, 0, ${isInactive ? 0.1 : 0.2})`;
      ctx.lineWidth = isInactive ? 4 : 12;
      ctx.setLineDash([oPerimeter * 0.3, oPerimeter * 0.7]);
      ctx.lineDashOffset = -t * 400;
      drawPillPath(ctx, ox, oy, oW, oH);
      ctx.stroke();

      if (!isInactive) {
        ctx.filter = 'blur(6px)';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(255, 120, 0, 0.4)';
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      ctx.restore();

      // 5. Hawking Radiation Particles
      // Reduce particle processing if inactive
      const activeParticles = isInactive ? particles.slice(0, 15) : particles;
      
      activeParticles.forEach(p => {
        p.x += p.v * 1.5;
        const distMult = 1.35 + Math.sin(t * 0.15 + p.a * 10) * 0.25;
        const orbitX = cx + Math.cos(p.x) * bhRx * (distMult + 0.2);
        const orbitY = cy + Math.sin(p.x) * bhRy * (distMult + 0.4);

        const size = p.s * 1.5;
        const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + p.a));

        ctx.beginPath();
        ctx.arc(orbitX, orbitY, size + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 100, 0, ${alpha * (isInactive ? 0.1 : 0.3)})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(orbitX, orbitY, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
        ctx.fill();
      });

      // 6. DEPTH OVERLAY
      const innerLens = ctx.createRadialGradient(cx, cy, 0, cx, cy, bhRx);
      innerLens.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
      innerLens.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      drawPillPath(ctx, cx - bhRx, cy - bhRy, pillW, pillH);
      ctx.fillStyle = innerLens;
      ctx.fill();

      t += 0.012;
      bhAnimRef.current = requestAnimationFrame(draw);
    };

    bhAnimRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(bhAnimRef.current);
  }, [theme.className, isInactive]);

  return (
    <canvas
      ref={canvasRef}
      className="bh-canvas"
      width={600}
      height={480}
    />
  );
};
