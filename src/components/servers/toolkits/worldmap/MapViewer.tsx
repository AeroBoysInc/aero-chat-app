// src/components/servers/toolkits/worldmap/MapViewer.tsx
import { memo, useRef, useState, useCallback, useEffect } from 'react';
import type { DndMapPin } from '../../../../lib/serverTypes';
import type { PinTypePreset } from '../../../../lib/pinTypePresets';
import { MapPin } from './MapPin';
import { ZoomControls } from './ZoomControls';
import { Minimap } from './Minimap';
import { AddPinMenu } from './AddPinMenu';

interface MapViewerProps {
  imageUrl: string;
  pins: DndMapPin[];
  isDm: boolean;
  onPinClick: (pin: DndMapPin) => void;
  onAddPin: (x: number, y: number, preset: PinTypePreset) => void;
}

export const MapViewer = memo(function MapViewer({
  imageUrl,
  pins,
  isDm,
  onPinClick,
  onAddPin,
}: MapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1); // user zoom: 1 = fit-to-view, 3 = max
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);

  // Drag state
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const [cursorStyle, setCursorStyle] = useState<'grab' | 'grabbing'>('grab');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ screenX: number; screenY: number; worldX: number; worldY: number } | null>(null);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Load image natural dimensions
  useEffect(() => {
    setImageSize(null);
    const img = new Image();
    img.onload = () => setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  // Base scale: fits the entire image within the container at zoom=1
  const baseScale = imageSize && containerSize.w > 0 && containerSize.h > 0
    ? Math.min(containerSize.w / imageSize.w, containerSize.h / imageSize.h)
    : 1;
  const effectiveScale = baseScale * scale;

  // Center image when loaded or container resizes
  useEffect(() => {
    if (!imageSize || containerSize.w === 0) return;
    const bs = Math.min(containerSize.w / imageSize.w, containerSize.h / imageSize.h);
    const rw = imageSize.w * bs;
    const rh = imageSize.h * bs;
    setPanX(rw < containerSize.w ? (containerSize.w - rw) / 2 : 0);
    setPanY(rh < containerSize.h ? (containerSize.h - rh) / 2 : 0);
    setScale(1);
  }, [imageSize, containerSize.w, containerSize.h]);

  // Clamp helper — centers axis when rendered size fits in container
  const clamp = useCallback((px: number, py: number, s: number) => {
    if (!imageSize || containerSize.w === 0) return { x: px, y: py };
    const es = baseScale * s;
    const rw = imageSize.w * es;
    const rh = imageSize.h * es;
    const cw = containerSize.w;
    const ch = containerSize.h;
    return {
      x: rw <= cw ? (cw - rw) / 2 : Math.max(-(rw - cw), Math.min(0, px)),
      y: rh <= ch ? (ch - rh) / 2 : Math.max(-(rh - ch), Math.min(0, py)),
    };
  }, [imageSize, baseScale, containerSize]);

  // Apply pan+zoom with clamping
  const applyTransform = useCallback((px: number, py: number, s: number) => {
    const clamped = clamp(px, py, s);
    setPanX(clamped.x);
    setPanY(clamped.y);
    setScale(s);
  }, [clamp]);

  // Mouse drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-hud]') || (e.target as HTMLElement).closest('[data-pin]')) return;
    dragging.current = true;
    dragMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { x: panX, y: panY };
    setCursorStyle('grabbing');
    e.preventDefault();
  }, [panX, panY]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
      const clamped = clamp(panStart.current.x + dx, panStart.current.y + dy, scale);
      setPanX(clamped.x);
      setPanY(clamped.y);
    };
    const handleMouseUp = () => {
      dragging.current = false;
      setCursorStyle('grab');
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [scale, clamp]);

  // Scroll wheel zoom toward cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if ((e.target as HTMLElement).closest('[data-hud]')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newScale = Math.max(1, Math.min(3, scale + delta));
    if (newScale === scale) return;

    const curEff = baseScale * scale;
    const newEff = baseScale * newScale;
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - panX) / curEff;
    const wy = (my - panY) / curEff;
    applyTransform(mx - wx * newEff, my - wy * newEff, newScale);
    setContextMenu(null);
  }, [scale, panX, panY, baseScale, applyTransform]);

  // Zoom buttons
  const zoomToCenter = useCallback((delta: number) => {
    const newScale = Math.max(1, Math.min(3, scale + delta));
    if (newScale === scale) return;
    const curEff = baseScale * scale;
    const newEff = baseScale * newScale;
    const cx = containerSize.w / 2;
    const cy = containerSize.h / 2;
    const wx = (cx - panX) / curEff;
    const wy = (cy - panY) / curEff;
    applyTransform(cx - wx * newEff, cy - wy * newEff, newScale);
  }, [scale, panX, panY, baseScale, containerSize, applyTransform]);

  // Minimap navigation
  const handleMinimapNavigate = useCallback((worldXPct: number, worldYPct: number) => {
    if (!imageSize) return;
    const es = effectiveScale;
    const px = -((worldXPct / 100) * imageSize.w * es - containerSize.w / 2);
    const py = -((worldYPct / 100) * imageSize.h * es - containerSize.h / 2);
    const clamped = clamp(px, py, scale);
    setPanX(clamped.x);
    setPanY(clamped.y);
  }, [imageSize, effectiveScale, containerSize, scale, clamp]);

  // Right-click to add pin
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isDm || !imageSize) return;
    if ((e.target as HTMLElement).closest('[data-hud]') || (e.target as HTMLElement).closest('[data-pin]')) return;
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldX = ((sx - panX) / effectiveScale) / imageSize.w * 100;
    const worldY = ((sy - panY) / effectiveScale) / imageSize.h * 100;
    setContextMenu({ screenX: e.clientX, screenY: e.clientY, worldX, worldY });
  }, [isDm, panX, panY, effectiveScale, imageSize]);

  // Pin click (ignore if was dragging)
  const handlePinClick = useCallback((pin: DndMapPin) => {
    if (dragMoved.current) return;
    onPinClick(pin);
  }, [onPinClick]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: cursorStyle, background: 'rgba(0,0,0,0.2)' }}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onClick={() => setContextMenu(null)}
    >
      {/* Map world layer — sized to actual image, scaled to fit container */}
      {imageSize && (
        <div
          style={{
            position: 'absolute',
            width: imageSize.w,
            height: imageSize.h,
            transformOrigin: '0 0',
            transform: `translate(${panX}px, ${panY}px) scale(${effectiveScale})`,
          }}
        >
          <img
            src={imageUrl}
            alt="Map"
            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
            draggable={false}
          />
          {pins.map(pin => (
            <MapPin
              key={pin.id}
              pin={pin}
              scale={effectiveScale}
              onPinClick={handlePinClick}
            />
          ))}
        </div>
      )}

      {/* HUD — not affected by zoom */}
      <div data-hud style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
        <div style={{ pointerEvents: 'all' }}>
          <ZoomControls scale={scale} onZoomIn={() => zoomToCenter(0.25)} onZoomOut={() => zoomToCenter(-0.25)} />
        </div>
        <div style={{ pointerEvents: 'all' }}>
          <Minimap
            imageUrl={imageUrl}
            pins={pins}
            panX={panX}
            panY={panY}
            effectiveScale={effectiveScale}
            containerWidth={containerSize.w}
            containerHeight={containerSize.h}
            imageWidth={imageSize?.w ?? 0}
            imageHeight={imageSize?.h ?? 0}
            onNavigate={handleMinimapNavigate}
          />
        </div>
        {isDm && (
          <div style={{
            position: 'absolute', bottom: 14, right: 14, pointerEvents: 'all',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,215,0,0.15)', borderRadius: 10,
            padding: '8px 14px', fontSize: 10, color: '#aaa',
          }}>
            <span style={{ color: 'var(--tk-gold, #FFD700)', fontWeight: 600 }}>Right-click</span> anywhere to add a pin
          </div>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <AddPinMenu
          x={contextMenu.screenX}
          y={contextMenu.screenY}
          onSelect={(preset) => {
            onAddPin(contextMenu.worldX, contextMenu.worldY, preset);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
});
