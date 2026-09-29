import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stroke, Point, ToolType, StickyNote, RoomUser, CanvasSettings } from '../types/drawing';
import { renderStroke, findStrokeAtPoint, smoothPoints } from '../utils/stroke';
import { playSound } from '../utils/audio';
import { User, Clock, Trash2 } from 'lucide-react';

interface CanvasProps {
  strokes: Stroke[];
  onAddStroke: (stroke: Stroke) => void;
  stickyNotes: StickyNote[];
  onAddStickyNote: (note: StickyNote) => void;
  onDeleteStickyNote: (noteId: string) => void;
  currentUser: RoomUser;
  activeTool: ToolType;
  currentColor: string;
  currentSize: number;
  canvasSettings: CanvasSettings;
  remoteCursors: Record<string, { x: number; y: number; isDrawing: boolean; tool: string }>;
  users: RoomUser[];
  onUpdateCursor: (x: number, y: number, isDrawing: boolean, tool: string) => void;
  onSendReaction: (emoji: string, x: number, y: number) => void;
  // Game restrictions if game is active
  isMyTurnInGame?: boolean;
  gamePhase?: string;
  zoom: number;
  panOffset: { x: number; y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  highlightedAuthorId: string | null;
  onSelectAuthorForFilter?: (authorId: string | null) => void;
  isDrawingBlocked?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({
  strokes,
  onAddStroke,
  stickyNotes,
  onDeleteStickyNote,
  currentUser,
  activeTool,
  currentColor,
  currentSize,
  canvasSettings,
  remoteCursors,
  users,
  onUpdateCursor,
  zoom,
  panOffset,
  setPanOffset,
  highlightedAuthorId,
  onSelectAuthorForFilter,
  isDrawingBlocked = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Current drawing state
  const isPointerDownRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);
  const lastPointTimeRef = useRef<number>(0);
  const lastPointPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pan state (spacebar or middle click)
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Inspector Hover State
  const [inspectedStroke, setInspectedStroke] = useState<Stroke | null>(null);
  const [inspectorPos, setInspectorPos] = useState<{ x: number; y: number } | null>(null);

  // Laser Pointer Trails
  const laserTrailsRef = useRef<{ x: number; y: number; alpha: number; time: number }[]>([]);
  const laserAnimRef = useRef<number | null>(null);

  // Keyboard spacebar listener for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        isPanningRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sync canvas size to container with DPI scaling
  const resizeCanvases = useCallback(() => {
    const container = containerRef.current;
    const baseCanvas = baseCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !baseCanvas || !overlayCanvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    baseCanvas.width = rect.width * dpr;
    baseCanvas.height = rect.height * dpr;
    baseCanvas.style.width = `${rect.width}px`;
    baseCanvas.style.height = `${rect.height}px`;

    overlayCanvas.width = rect.width * dpr;
    overlayCanvas.height = rect.height * dpr;
    overlayCanvas.style.width = `${rect.width}px`;
    overlayCanvas.style.height = `${rect.height}px`;

    drawBaseCanvas();
  }, [strokes, zoom, panOffset, canvasSettings.authorOverlayMode, highlightedAuthorId]);

  useEffect(() => {
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    return () => window.removeEventListener('resize', resizeCanvases);
  }, [resizeCanvases]);

  // Redraw all committed strokes on the base canvas
  const drawBaseCanvas = useCallback(() => {
    const baseCanvas = baseCanvasRef.current;
    if (!baseCanvas) return;
    const ctx = baseCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    strokes.forEach(stroke => {
      // If author filtering is active, fade out non-highlighted strokes
      let colorOverride: string | undefined = undefined;
      
      if (canvasSettings.authorOverlayMode) {
        colorOverride = stroke.authorColor;
      }

      if (highlightedAuthorId && stroke.authorId !== highlightedAuthorId) {
        ctx.globalAlpha = 0.15;
      } else {
        ctx.globalAlpha = 1.0;
      }

      renderStroke(ctx, stroke, colorOverride);
    });

    ctx.restore();
  }, [strokes, zoom, panOffset, canvasSettings.authorOverlayMode, highlightedAuthorId]);

  useEffect(() => {
    drawBaseCanvas();
  }, [drawBaseCanvas]);

  // Convert screen coordinates to world canvas coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;

    return {
      x: (relX - panOffset.x) / zoom,
      y: (relY - panOffset.y) / zoom
    };
  }, [panOffset, zoom]);

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: rect.left + worldX * zoom + panOffset.x,
      y: rect.top + worldY * zoom + panOffset.y
    };
  }, [panOffset, zoom]);

  // Keep stroke weight stable across pointer types and devices.
  const computePressure = useCallback((e: React.PointerEvent<HTMLCanvasElement>, worldPos: { x: number; y: number }): number => {
    const now = performance.now();
    const dt = Math.max(1, now - lastPointTimeRef.current);
    const dist = Math.hypot(worldPos.x - lastPointPosRef.current.x, worldPos.y - lastPointPosRef.current.y);
    const speed = dist / dt;

    // Faster speed -> slightly tapered stroke
    return Math.max(0.35, Math.min(0.8, 0.7 - speed * 0.1));
  }, []);

  // Animate laser pointer trails on overlay canvas
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderLaser = () => {
      const now = performance.now();
      laserTrailsRef.current = laserTrailsRef.current.filter(p => now - p.time < 1200);

      if (laserTrailsRef.current.length > 0) {
        // Redraw laser
        drawActiveOverlay();
      }

      animId = requestAnimationFrame(renderLaser);
    };

    animId = requestAnimationFrame(renderLaser);
    laserAnimRef.current = animId;

    return () => cancelAnimationFrame(animId);
  }, []);

  // Draw overlay (in-progress stroke + laser + inspector highlight)
  const drawActiveOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Active Stroke
    if (isPointerDownRef.current && currentPointsRef.current.length > 0 && activeTool !== 'inspect' && activeTool !== 'laser') {
      const tempStroke: Stroke = {
        id: 'temp',
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorColor: currentUser.color,
        tool: activeTool as Stroke['tool'],
        color: currentColor,
        size: currentSize,
        points: currentPointsRef.current,
        timestamp: Date.now()
      };
      renderStroke(ctx, tempStroke);
    }

    // 2. Draw Laser Trails
    if (laserTrailsRef.current.length > 1) {
      const now = performance.now();
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < laserTrailsRef.current.length - 1; i++) {
        const p1 = laserTrailsRef.current[i];
        const p2 = laserTrailsRef.current[i + 1];
        const age = now - p2.time;
        const alpha = Math.max(0, 1 - age / 1200);

        ctx.strokeStyle = `rgba(255, 30, 86, ${alpha})`;
        ctx.lineWidth = Math.max(3, currentSize * 1.5 * alpha);
        ctx.shadowColor = '#FF0055';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Draw Inspected Stroke Halo if hovering in Inspector Mode
    if (activeTool === 'inspect' && inspectedStroke) {
      ctx.save();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = Math.max(inspectedStroke.size + 8, 12);
      ctx.setLineDash([8, 6]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const pts = inspectedStroke.points;
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [panOffset, zoom, activeTool, currentColor, currentSize, currentUser, inspectedStroke]);

  // Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Check spacebar pan or middle click
    if (isSpacePressed || e.button === 1) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }

    if (e.button !== 0) return; // Only primary button
    if (isDrawingBlocked) return;

    const worldPos = screenToWorld(e.clientX, e.clientY);
    lastPointTimeRef.current = performance.now();
    lastPointPosRef.current = worldPos;

    // Inspector Mode click
    if (activeTool === 'inspect') {
      const hit = findStrokeAtPoint(strokes, worldPos.x, worldPos.y, 14 / zoom);
      if (hit) {
        setInspectedStroke(hit);
        setInspectorPos({ x: e.clientX, y: e.clientY });
        playSound('pop', canvasSettings.soundEnabled);
        if (onSelectAuthorForFilter) {
          onSelectAuthorForFilter(hit.authorId);
        }
      } else {
        setInspectedStroke(null);
        setInspectorPos(null);
        if (onSelectAuthorForFilter) {
          onSelectAuthorForFilter(null);
        }
      }
      return;
    }

    // Laser pointer
    if (activeTool === 'laser') {
      isPointerDownRef.current = true;
      laserTrailsRef.current.push({ ...worldPos, alpha: 1, time: performance.now() });
      playSound('draw', canvasSettings.soundEnabled);
      return;
    }

    // Normal drawing
    isPointerDownRef.current = true;
    const initialPressure = computePressure(e, worldPos);
    currentPointsRef.current = [{ ...worldPos, pressure: initialPressure, time: Date.now() }];

    playSound('draw', canvasSettings.soundEnabled);
    onUpdateCursor(worldPos.x, worldPos.y, true, activeTool);
    drawActiveOverlay();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Panning
    if (isPanningRef.current) {
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
      return;
    }

    const worldPos = screenToWorld(e.clientX, e.clientY);
    onUpdateCursor(worldPos.x, worldPos.y, isPointerDownRef.current, activeTool);

    // Inspector Mode Hover
    if (activeTool === 'inspect' && !isPointerDownRef.current) {
      const hit = findStrokeAtPoint(strokes, worldPos.x, worldPos.y, 12 / zoom);
      if (hit !== inspectedStroke) {
        setInspectedStroke(hit);
        if (hit) {
          setInspectorPos({ x: e.clientX, y: e.clientY });
        } else {
          setInspectorPos(null);
        }
        drawActiveOverlay();
      }
      return;
    }

    if (!isPointerDownRef.current) return;

    // Laser pointer movement
    if (activeTool === 'laser') {
      laserTrailsRef.current.push({ ...worldPos, alpha: 1, time: performance.now() });
      drawActiveOverlay();
      return;
    }

    // Drawing movement
    const pressure = computePressure(e, worldPos);
    currentPointsRef.current.push({ ...worldPos, pressure, time: Date.now() });

    lastPointTimeRef.current = performance.now();
    lastPointPosRef.current = worldPos;

    drawActiveOverlay();
  };

  const handlePointerUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (activeTool === 'laser') {
      return;
    }

    if (currentPointsRef.current.length > 0) {
      const smoothed = canvasSettings.smoothing === 'high' 
        ? smoothPoints(currentPointsRef.current) 
        : currentPointsRef.current;

      const newStroke: Stroke = {
        id: `str_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorColor: currentUser.color,
        tool: activeTool as Stroke['tool'],
        color: currentColor,
        size: currentSize,
        points: smoothed,
        timestamp: Date.now()
      };

      onAddStroke(newStroke);
      currentPointsRef.current = [];
    }

    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    onUpdateCursor(0, 0, false, activeTool);
  };

  // Wheel zoom / pan
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(0.2, zoom * zoomFactor), 4.0);
      
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPanOffset(prev => ({
        x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / zoom)
      }));
    } else {
      // Pan
      setPanOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Cursor CSS style based on tool & spacebar
  const getCursorClass = () => {
    if (isSpacePressed || isPanningRef.current) return 'cursor-grab active:cursor-grabbing';
    if (activeTool === 'inspect') return 'cursor-help';
    if (activeTool === 'eraser') return 'cursor-crosshair';
    if (activeTool === 'laser') return 'cursor-pointer';
    if (isDrawingBlocked) return 'cursor-not-allowed';
    return 'cursor-crosshair';
  };

  return (
    <div 
      ref={containerRef}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden select-none touch-none ${
        canvasSettings.background === 'dots' ? 'canvas-grid-dots' :
        canvasSettings.background === 'lines' ? 'canvas-grid-lines' :
        canvasSettings.background === 'graph' ? 'canvas-grid-graph' :
        'bg-[#FFFDF5]'
      } ${getCursorClass()}`}
    >
      {/* Base Canvas: Committed Strokes */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Overlay Canvas: Active in-progress stroke & laser & inspect highlighting */}
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0"
      />

      {/* Sticky Notes HTML Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {stickyNotes.map(note => {
          const screenPos = worldToScreen(note.x, note.y);
          return (
            <div
              key={note.id}
              style={{
                transform: `translate(${screenPos.x}px, ${screenPos.y}px) scale(${zoom})`,
                transformOrigin: 'top left',
                backgroundColor: note.color
              }}
              className="pointer-events-auto absolute w-52 p-3 border-3 border-black brutal-shadow transition-shadow group rounded-none"
            >
              <div className="flex items-center justify-between border-b-2 border-black/30 pb-1 mb-2 text-xs font-bold font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: note.authorColor }} />
                  {note.authorName}
                </span>
                <button
                  onClick={() => onDeleteStickyNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                  title="Delete Note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-medium whitespace-pre-wrap break-words text-black">
                {note.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Remote Multi-User Cursors */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Object.entries(remoteCursors).map(([uid, cursor]) => {
          if (uid === currentUser.id || !cursor) return null;
          const user = users.find(u => u.id === uid);
          if (!user) return null;
          const screenPos = worldToScreen(cursor.x, cursor.y);

          return (
            <div
              key={uid}
              style={{
                transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
                transition: 'transform 0.04s linear'
              }}
              className="absolute pointer-events-none z-30"
            >
              <div className="relative">
                {/* Pointer Arrow */}
                <svg
                  className="w-5 h-5 drop-shadow-[2px_2px_0px_#000]"
                  viewBox="0 0 24 24"
                  fill={user.color}
                  stroke="#000000"
                  strokeWidth="2"
                >
                  <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
                </svg>

                {/* Nickname & Avatar Tag */}
                <div
                  style={{ backgroundColor: user.color }}
                  className="absolute left-4 top-2 flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-white border-2 border-black brutal-shadow-sm whitespace-nowrap"
                >
                  <span>{user.avatar}</span>
                  <span className="text-black font-heading tracking-tight">{user.name}</span>
                  {cursor.isDrawing && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block ml-0.5" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* "Who Drew This?" Interactive Floating Inspector Card */}
      {activeTool === 'inspect' && inspectedStroke && inspectorPos && (
        <div
          style={{
            left: `${Math.min(window.innerWidth - 260, inspectorPos.x + 16)}px`,
            top: `${Math.min(window.innerHeight - 180, inspectorPos.y + 16)}px`
          }}
          className="fixed z-50 p-3 bg-white border-3 border-black brutal-shadow-lg max-w-xs animate-in fade-in duration-100"
        >
          <div className="text-[10px] uppercase font-black font-mono tracking-wider text-[#FF5470] mb-1">
            🔍 Who Drew This?
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-7 h-7 border-2 border-black flex items-center justify-center font-bold text-base brutal-shadow-sm"
              style={{ backgroundColor: inspectedStroke.authorColor }}
            >
              {inspectedStroke.authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-heading font-black text-sm flex items-center gap-1">
                {inspectedStroke.authorName}
                {inspectedStroke.authorId === currentUser.id && (
                  <span className="text-[10px] bg-[#FFE600] px-1 border border-black font-mono">YOU</span>
                )}
              </div>
              <div className="text-[11px] text-neutral-600 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 inline" />
                {new Date(inspectedStroke.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>

          <div className="text-xs bg-[#FFFDF5] border-2 border-black p-2 font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">Tool:</span>
              <span className="font-bold uppercase text-black">{inspectedStroke.tool}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Brush Size:</span>
              <span className="font-bold text-black">{inspectedStroke.size}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Points:</span>
              <span className="font-bold text-black">{inspectedStroke.points.length} nodes</span>
            </div>
          </div>

          <button
            onClick={() => onSelectAuthorForFilter && onSelectAuthorForFilter(
              highlightedAuthorId === inspectedStroke.authorId ? null : inspectedStroke.authorId
            )}
            className="w-full mt-2.5 py-1 text-xs font-bold font-heading bg-[#FFE600] border-2 border-black brutal-shadow-sm hover:bg-[#FFD600] active:translate-y-[1px]"
          >
            {highlightedAuthorId === inspectedStroke.authorId ? 'Show All Authors' : `Highlight All by ${inspectedStroke.authorName}`}
          </button>
        </div>
      )}
    </div>
  );
};
