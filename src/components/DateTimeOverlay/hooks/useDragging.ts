import { useRef, useEffect } from 'react';

export const useDragging = (
  position: { x: number; y: number },
  setPosition: (pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void,
  setIsExpanded: (val: boolean | ((prev: boolean) => boolean)) => void,
  setDragging: (val: boolean) => void,
  overlayRef: React.RefObject<HTMLDivElement>
) => {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartCoordsRef = useRef({ x: 0, y: 0 });

  const snapToEdge = () => {
    if (!overlayRef.current) return;
    const padding = 20, snapThreshold = 60;
    const width = overlayRef.current.offsetWidth;
    const height = overlayRef.current.offsetHeight;
    
    setPosition((prev: { x: number; y: number }) => {
      const distToLeft = prev.x;
      const distToRight = window.innerWidth - (prev.x + width);
      const distToBottom = prev.y;
      const distToTop = window.innerHeight - (prev.y + height);
      
      let targetX = prev.x;
      let targetY = prev.y;
      
      if (distToLeft < snapThreshold) targetX = padding;
      else if (distToRight < snapThreshold) targetX = window.innerWidth - width - padding;
      
      if (distToBottom < snapThreshold) targetY = padding;
      else if (distToTop < snapThreshold) targetY = window.innerHeight - height - padding;
      
      return { x: targetX, y: targetY };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent dragging when clicking on interactive elements
    if ((e.target as HTMLElement).closest('.findr-control-center')) return;
    if ((e.target as HTMLElement).closest('.findr-sw-controls')) return;
    if (e.button !== 0) return; // Only left click
    
    e.preventDefault();
    isDraggingRef.current = true;
    setDragging(true);
    
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: (window.innerHeight - e.clientY) - position.y
    };
    dragStartCoordsRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const newX = e.clientX - dragStartRef.current.x;
      const newY = (window.innerHeight - e.clientY) - dragStartRef.current.y;

      const overlayWidth = overlayRef.current?.offsetWidth || 200;
      const overlayHeight = (overlayRef.current?.querySelector('.findr-datetime-content') as HTMLElement)?.offsetHeight || 44;

      const bounds = {
        minX: 10, minY: 10,
        maxX: window.innerWidth - overlayWidth - 10,
        maxY: window.innerHeight - overlayHeight - 10
      };

      setPosition({
        x: Math.max(bounds.minX, Math.min(newX, bounds.maxX)),
        y: Math.max(bounds.minY, Math.min(newY, bounds.maxY))
      });
    };

    const handleMouseUpGlobal = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      isDraggingRef.current = false;
      setDragging(false);
      
      const dist = Math.sqrt(
        Math.pow(e.clientX - dragStartCoordsRef.current.x, 2) +
        Math.pow(e.clientY - dragStartCoordsRef.current.y, 2)
      );
      
      if (dist < 5) {
        setIsExpanded(prev => !prev);
      } else {
        snapToEdge();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, [position]);

  return { handleMouseDown };
};
