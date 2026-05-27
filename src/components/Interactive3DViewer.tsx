import React, { useRef, useEffect, useState } from 'react';
import { API_BASE } from '../services/api';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Bounds {
  x: number;
  y: number;
  z: number;
}

interface PointsResponse {
  points: Point3D[];
  bounds: Bounds;
  part_name: string;
}

interface Interactive3DViewerProps {
  fileId: number;
  fileName: string;
  height?: string | number;
}

const Interactive3DViewer: React.FC<Interactive3DViewerProps> = ({ fileId, fileName, height = 450 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [points, setPoints] = useState<Point3D[]>([]);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [partName, setPartName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction State
  const rotationRef = useRef({ theta: Math.PI / 9, phi: Math.PI / 5 }); // initial view angle
  const zoomRef = useRef(1.0);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const spinVelocity = useRef({ theta: 0.005, phi: 0.002 }); // Auto spin at start

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/parts/points/${fileId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load 3D point cloud data');
        return res.json() as Promise<PointsResponse>;
      })
      .then((data) => {
        if (!active) return;
        setPoints(data.points);
        setBounds(data.bounds);
        setPartName(data.part_name);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Error loading 3D preview');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fileId]);

  useEffect(() => {
    if (loading || error || points.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Calculate center of mass of the point cloud
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const zs = points.map((p) => p.z);

    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxDim = Math.max(sizeX, sizeY, sizeZ) || 1;

    // Dimensions of bounding box corners relative to center
    const hx = sizeX / 2;
    const hy = sizeY / 2;
    const hz = sizeZ / 2;

    const boxCorners: Point3D[] = [
      { x: -hx, y: -hy, z: -hz },
      { x: hx, y: -hy, z: -hz },
      { x: hx, y: hy, z: -hz },
      { x: -hx, y: hy, z: -hz },
      { x: -hx, y: -hy, z: hz },
      { x: hx, y: -hy, z: hz },
      { x: hx, y: hy, z: hz },
      { x: -hx, y: hy, z: hz },
    ];

    const boxEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Back face
      [4, 5], [5, 6], [6, 7], [7, 4], // Front face
      [0, 4], [1, 5], [2, 6], [3, 7], // Connecting edges
    ];

    const render = () => {
      // Resize canvas to match display size
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw premium dark slate background gradient
      const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h));
      grad.addColorStop(0, '#1a1f29');
      grad.addColorStop(1, '#0f1115');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Decelerate auto-spin if dragging
      if (isDragging.current) {
        spinVelocity.current.theta *= 0.8;
        spinVelocity.current.phi *= 0.8;
      } else {
        rotationRef.current.theta += spinVelocity.current.theta;
        rotationRef.current.phi += spinVelocity.current.phi;
        // Keep auto-spin ticking slowly
        rotationRef.current.theta += 0.0005;
        rotationRef.current.phi += 0.0002;
      }

      const theta = rotationRef.current.theta;
      const phi = rotationRef.current.phi;
      const zoom = zoomRef.current;

      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const cosP = Math.cos(phi), sinP = Math.sin(phi);

      const scx = w / 2;
      const scy = h / 2;

      // Scale to fit 70% of canvas
      const scale = ((Math.min(w, h) * 0.7) / maxDim) * zoom;

      // 3D Projection Function
      const project = (p: Point3D) => {
        // Translation relative to center
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dz = p.z - cz;

        // Rotation
        const x1 = dx * cosP - dz * sinP;
        const z1 = dx * sinP + dz * cosP;
        const y2 = dy * cosT - z1 * sinT;
        const z2 = dy * sinT + z1 * cosT;

        // 2D Screen Projection
        const sx = scx + x1 * scale;
        const sy = scy - y2 * scale;

        return { x: sx, y: sy, z: z2 };
      };

      // 1. Draw Bounding Box Cage (Dimension Caging)
      const projectedCorners = boxCorners.map(project);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      boxEdges.forEach(([start, end]) => {
        const p1 = projectedCorners[start];
        const p2 = projectedCorners[end];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // 2. Draw Point Cloud
      const projectedPoints = points.map((p) => {
        const proj = project(p);
        return { ...proj, p };
      });

      // Sort by depth for correct Z-ordering
      projectedPoints.sort((a, b) => a.z - b.z);

      projectedPoints.forEach(({ x, y, z }) => {
        if (x < 0 || x > w || y < 0 || y > h) return;

        // Depth Cueing (smaller, dimmer in back; larger, brighter in front)
        const depthRatio = (z + maxDim) / (2 * maxDim);
        const intensity = Math.max(0.1, Math.min(1.0, depthRatio));

        // Premium brand color gradient (cyan to green)
        const r = Math.floor(0 + 120 * (1 - intensity));
        const g = Math.floor(190 + 65 * intensity);
        const b = Math.floor(210 + 45 * (1 - intensity));

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensity * 0.95})`;
        ctx.beginPath();
        // Dot size scales with zoom and depth
        const radius = Math.max(1, (1.8 + intensity * 1.5) * Math.sqrt(zoom));
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      });

      // 3. Draw Dimensions Text / UI Overlays
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '11px Outfit, Inter, sans-serif';

      // Bounding box size annotations
      ctx.fillText(`X: ${sizeX.toFixed(1)} mm`, 20, h - 60);
      ctx.fillText(`Y: ${sizeY.toFixed(1)} mm`, 20, h - 42);
      ctx.fillText(`Z: ${sizeZ.toFixed(1)} mm`, 20, h - 24);

      ctx.textAlign = 'right';
      ctx.fillText('Drag to Rotate | Scroll to Zoom', w - 20, h - 24);

      if (partName) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.font = 'bold 12px Outfit, Inter, sans-serif';
        ctx.fillText(`PART: ${partName}`, 20, 30);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [loading, error, points]);

  // Handle Drag Interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    // Negate deltas for natural (non-inverted) drag feel
    rotationRef.current.phi -= deltaX * 0.007;
    rotationRef.current.theta -= deltaY * 0.007;

    // Bound theta to prevent gimbal lock flips
    rotationRef.current.theta = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotationRef.current.theta));

    // Capture drag velocity for smooth throw on release (match negated direction)
    spinVelocity.current = {
      theta: +deltaY * 0.0005,
      phi: +deltaX * 0.0005,
    };

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomRef.current = Math.max(0.2, Math.min(5.0, zoomRef.current * zoomFactor));
  };

  if (loading) {
    return (
      <div className="viewer-loading" style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f1115', color: '#888' }}>
        <div className="file-preview-spinner" style={{ marginBottom: 15 }}></div>
        <div style={{ fontSize: '12px' }}>Loading Interactive 3D Model...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1115', color: '#ff4d4d', fontSize: '13px' }}>
        {error}
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', height, overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'grab', borderRadius: '8px' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
};

export default Interactive3DViewer;
