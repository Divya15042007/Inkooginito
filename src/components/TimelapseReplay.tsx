import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, SkipBack, SkipForward, X, Clock, User } from 'lucide-react';
import { Stroke } from '../types/drawing';
import { renderStroke } from '../utils/stroke';
import { playSound } from '../utils/audio';

interface TimelapseReplayProps {
  isOpen: boolean;
  onClose: () => void;
  strokes: Stroke[];
  soundEnabled: boolean;
}

export const TimelapseReplay: React.FC<TimelapseReplayProps> = ({
  isOpen,
  onClose,
  strokes,
  soundEnabled
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    }
  }, [isOpen]);

  // Compute bounding box
  const getCanvasBounds = () => {
    if (strokes.length === 0) return { minX: 0, minY: 0, width: 800, height: 600 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    strokes.forEach(s => {
      s.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    const padding = 40;
    minX = Math.floor(minX - padding);
    minY = Math.floor(minY - padding);
    maxX = Math.ceil(maxX + padding);
    maxY = Math.ceil(maxY + padding);

    return { minX, minY, width: Math.max(600, maxX - minX), height: Math.max(400, maxY - minY) };
  };

  // Render current frame
  const drawFrame = (upToIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bounds = getCanvasBounds();
    canvas.width = bounds.width;
    canvas.height = bounds.height;

    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-bounds.minX, -bounds.minY);

    for (let i = 0; i <= upToIndex && i < strokes.length; i++) {
      renderStroke(ctx, strokes[i]);
    }

    ctx.restore();
  };

  useEffect(() => {
    if (!isOpen) return;
    drawFrame(currentIndex);
  }, [isOpen, currentIndex, strokes]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      return;
    }

    const intervalMs = Math.max(20, Math.floor(250 / speed));

    animTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= strokes.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, [isPlaying, speed, strokes.length]);

  if (!isOpen) return null;

  const currentStroke = strokes[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-5 max-w-3xl w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 fill-[#00E5FF] text-black" />
            <h2 className="font-heading font-black text-xl tracking-tight uppercase">
              Stroke-by-Stroke Timelapse
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border-2 border-black bg-white hover:bg-red-500 hover:text-white font-bold flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas Display Viewport */}
        <div className="flex-1 bg-white border-3 border-black p-2 min-h-[300px] max-h-[500px] flex items-center justify-center overflow-hidden brutal-shadow-sm mb-4 relative">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain"
          />

          {/* Current Author Badge in Replay */}
          {currentStroke && (
            <div className="absolute top-4 left-4 bg-white border-2 border-black p-2 brutal-shadow-sm flex items-center gap-2 font-mono text-xs">
              <div
                className="w-3.5 h-3.5 border border-black"
                style={{ backgroundColor: currentStroke.authorColor }}
              />
              <span className="font-heading font-bold">{currentStroke.authorName}</span>
              <span className="text-neutral-500">
                · {new Date(currentStroke.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* Scrubber Progress Bar */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between font-mono text-xs font-bold text-neutral-600">
            <span>Stroke {currentIndex + 1} of {strokes.length}</span>
            <span>{Math.round(((currentIndex + 1) / Math.max(1, strokes.length)) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(0, strokes.length - 1)}
            value={currentIndex}
            onChange={(e) => {
              setCurrentIndex(Number(e.target.value));
              setIsPlaying(false);
            }}
            className="w-full accent-black cursor-pointer"
          />
        </div>

        {/* Playback Controls Dock */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t-2 border-black">
          <div className="flex items-center gap-1.5">
            {/* Rewind to Start */}
            <button
              onClick={() => {
                setCurrentIndex(0);
                setIsPlaying(false);
                playSound('click', soundEnabled);
              }}
              className="p-2 border-2 border-black bg-white hover:bg-neutral-100 cursor-pointer"
              title="Reset to Beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Step Back */}
            <button
              onClick={() => {
                setCurrentIndex(prev => Math.max(0, prev - 1));
                setIsPlaying(false);
              }}
              className="p-2 border-2 border-black bg-white hover:bg-neutral-100 cursor-pointer"
              title="Step Backward"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={() => {
                if (currentIndex >= strokes.length - 1) {
                  setCurrentIndex(0);
                }
                setIsPlaying(!isPlaying);
                playSound('click', soundEnabled);
              }}
              className="px-4 py-2 bg-[#FFE600] border-2 border-black brutal-shadow font-heading font-black text-sm flex items-center gap-1.5 cursor-pointer hover:bg-[#FFD600]"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* Step Forward */}
            <button
              onClick={() => {
                setCurrentIndex(prev => Math.min(strokes.length - 1, prev + 1));
                setIsPlaying(false);
              }}
              className="p-2 border-2 border-black bg-white hover:bg-neutral-100 cursor-pointer"
              title="Step Forward"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 font-mono text-xs font-bold">
            <span className="text-neutral-500 mr-1">Speed:</span>
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 border-2 border-black cursor-pointer ${
                  speed === s ? 'bg-[#A3E635] brutal-shadow-sm font-black' : 'bg-white hover:bg-neutral-100'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
