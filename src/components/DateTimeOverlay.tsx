import React, { useState, useEffect, useRef } from 'react';
import './DateTimeOverlay.css';

/**
 * A global, draggable, glassmorphic DateTime overlay.
 */
interface ColorSync {
  bg: string;
  text: string;
  sub: string;
  accent: string;
  border: string;
  drag: string;
}

const COLOR_MODES: ColorSync[] = [
  { bg: 'rgba(255, 255, 255, 0.45)', text: '#1e293b', sub: '#64748b', accent: '#2563eb', border: 'rgba(0, 0, 0, 0.05)', drag: '#94a3b8' }, // Crystal
  { bg: 'rgba(37, 99, 235, 0.45)', text: '#ffffff', sub: 'rgba(255, 255, 255, 0.7)', accent: '#ffffff', border: 'rgba(255, 255, 255, 0.15)', drag: 'rgba(255, 255, 255, 0.4)' }, // Ocean
  { bg: 'rgba(22, 163, 74, 0.45)', text: '#ffffff', sub: 'rgba(255, 255, 255, 0.7)', accent: '#ffffff', border: 'rgba(255, 255, 255, 0.15)', drag: 'rgba(255, 255, 255, 0.4)' }, // Emerald
  { bg: 'rgba(220, 38, 38, 0.45)', text: '#ffffff', sub: 'rgba(255, 255, 255, 0.7)', accent: '#ffffff', border: 'rgba(255, 255, 255, 0.15)', drag: 'rgba(255, 255, 255, 0.4)' }, // Ruby
  { bg: 'rgba(124, 58, 237, 0.45)', text: '#ffffff', sub: 'rgba(255, 255, 255, 0.7)', accent: '#ffffff', border: 'rgba(255, 255, 255, 0.15)', drag: 'rgba(255, 255, 255, 0.4)' }, // Amethyst
  { bg: 'rgba(217, 119, 6, 0.45)', text: '#ffffff', sub: 'rgba(255, 255, 255, 0.7)', accent: '#ffffff', border: 'rgba(255, 255, 255, 0.15)', drag: 'rgba(255, 255, 255, 0.4)' }, // Amber
];

const DateTimeOverlay: React.FC = () => {
  const [time, setTime] = useState(new Date());
  // Default position: bottom center
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 100, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 }); // To detect if it was a real drag or just a click
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpLocal = (e: React.MouseEvent) => {
    // If the movement was very small, treat it as a click to change color
    const dist = Math.sqrt(Math.pow(e.clientX - dragStartPos.current.x, 2) + Math.pow(e.clientY - dragStartPos.current.y, 2));
    if (dist < 5) {
      setColorIndex((prev) => (prev + 1) % COLOR_MODES.length);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      
      // Keep within bounds
      const bounds = {
        minX: 20,
        minY: 20,
        maxX: window.innerWidth - (overlayRef.current?.offsetWidth || 200) - 20,
        maxY: window.innerHeight - (overlayRef.current?.offsetHeight || 40) - 20
      };

      setPosition({
        x: Math.max(bounds.minX, Math.min(newX, bounds.maxX)),
        y: Math.max(bounds.minY, Math.min(newY, bounds.maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const mode = COLOR_MODES[colorIndex];

  return (
    <div 
      ref={overlayRef}
      className={`findr-global-datetime ${isDragging ? 'dragging' : ''}`}
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        backgroundColor: mode.bg,
        color: mode.text,
        borderColor: mode.border
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUpLocal}
    >
      <span className="findr-datetime-time" style={{ color: mode.accent }}>{timeStr}</span>
      <div className="findr-datetime-separator" style={{ backgroundColor: mode.drag }} />
      <span className="findr-datetime-date" style={{ color: mode.sub }}>{dateStr}</span>
    </div>
  );
};

export default DateTimeOverlay;
