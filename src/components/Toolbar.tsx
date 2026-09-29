import React, { useState } from 'react';
import { 
  PenTool, 
  Paintbrush, 
  Highlighter, 
  Feather, 
  Eraser, 
  Square, 
  Circle, 
  ArrowRight, 
  Minus, 
  StickyNote as StickyIcon, 
  Search, 
  Zap, 
  Sliders, 
  Sparkles,
  Volume2,
  VolumeX,
  Palette,
  Grid
} from 'lucide-react';
import { ToolType, CanvasSettings, CanvasBackground } from '../types/drawing';
import { playSound } from '../utils/audio';

const PALETTE = [
  '#000000', // Jet Black
  '#FFFFFF', // Pure White
  '#FFE600', // Cyber Yellow
  '#A3E635', // Electric Lime
  '#FF3366', // Bubblegum Pink
  '#00E5FF', // Cyan
  '#FF6B00', // Vivid Orange
  '#A855F7', // Purple
  '#EF4444', // Crimson Red
  '#3B82F6'  // Royal Blue
];

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  currentColor: string;
  setCurrentColor: (color: string) => void;
  currentSize: number;
  setCurrentSize: (size: number) => void;
  canvasSettings: CanvasSettings;
  setCanvasSettings: React.Dispatch<React.SetStateAction<CanvasSettings>>;
  onAddStickyNote: () => void;
  isDrawingBlocked?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setActiveTool,
  currentColor,
  setCurrentColor,
  currentSize,
  setCurrentSize,
  canvasSettings,
  setCanvasSettings,
  onAddStickyNote,
  isDrawingBlocked = false
}) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const selectTool = (tool: ToolType) => {
    setActiveTool(tool);
    playSound('click', canvasSettings.soundEnabled);
  };

  const selectColor = (color: string) => {
    setCurrentColor(color);
    playSound('pop', canvasSettings.soundEnabled);
  };

  return (
    <>
      {/* Floating Main Dock */}
      <aside aria-label="Drawing Tools" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-[95vw]">
        {/* Quick Color Swatches Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white border-3 border-black brutal-shadow overflow-x-auto max-w-full">
          {PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => selectColor(color)}
              style={{ backgroundColor: color }}
              title={`Color ${color}`}
              className={`w-6 h-6 border-2 border-black transition-transform cursor-pointer ${
                currentColor.toLowerCase() === color.toLowerCase()
                  ? 'scale-125 ring-2 ring-black brutal-shadow-sm -translate-y-1'
                  : 'hover:scale-110'
              }`}
            />
          ))}

          {/* Custom Color Input */}
          <label className="relative w-6 h-6 border-2 border-black bg-gradient-to-tr from-yellow-300 via-pink-400 to-cyan-400 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => selectColor(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              title="Custom Hex Color"
            />
          </label>

          {/* Stroke Width Slider / Indicator */}
          <div className="h-6 w-[2px] bg-black mx-1" />
          <div className="flex items-center gap-1.5 px-1 font-mono text-xs font-bold">
            <span className="text-neutral-500">Size:</span>
            <input
              type="range"
              min="2"
              max="48"
              value={currentSize}
              onChange={(e) => setCurrentSize(Number(e.target.value))}
              className="w-16 accent-black cursor-pointer"
              title={`Brush Size: ${currentSize}px`}
            />
            <span className="w-5 text-right">{currentSize}</span>
          </div>
        </div>

        {/* Primary Tool Buttons Bar */}
        <div className="flex items-center gap-1 p-2 bg-[#FFFDF5] border-3 border-black brutal-shadow-lg flex-wrap justify-center">
          {/* Pen */}
          <button
            onClick={() => selectTool('pen')}
            disabled={isDrawingBlocked}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'pen'
                ? 'bg-[#FFE600] brutal-shadow-sm -translate-y-0.5'
                : 'bg-white hover:bg-neutral-100'
            }`}
            title="Pen"
          >
            <PenTool className="w-4 h-4" />
            <span className="text-xs hidden sm:inline font-heading font-black">Pen</span>
          </button>

          {/* Calligraphy */}
          <button
            onClick={() => selectTool('calligraphy')}
            disabled={isDrawingBlocked}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'calligraphy'
                ? 'bg-[#A3E635] brutal-shadow-sm -translate-y-0.5'
                : 'bg-white hover:bg-neutral-100'
            }`}
            title="Calligraphy Brush (Chisel Ribbon)"
          >
            <Feather className="w-4 h-4" />
            <span className="text-xs hidden sm:inline font-heading font-black">Chisel</span>
          </button>

          {/* Highlighter */}
          <button
            onClick={() => selectTool('highlighter')}
            disabled={isDrawingBlocked}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'highlighter'
                ? 'bg-[#00E5FF] brutal-shadow-sm -translate-y-0.5'
                : 'bg-white hover:bg-neutral-100'
            }`}
            title="Highlighter (Semi-transparent)"
          >
            <Highlighter className="w-4 h-4" />
            <span className="text-xs hidden sm:inline font-heading font-black">Marker</span>
          </button>

          {/* Brush */}
          <button
            onClick={() => selectTool('brush')}
            disabled={isDrawingBlocked}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'brush'
                ? 'bg-[#FF3366] text-white brutal-shadow-sm -translate-y-0.5'
                : 'bg-white hover:bg-neutral-100'
            }`}
            title="Paint Brush"
          >
            <Paintbrush className="w-4 h-4" />
            <span className="text-xs hidden sm:inline font-heading font-black">Brush</span>
          </button>

          {/* Laser Pointer */}
          <button
            onClick={() => selectTool('laser')}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'laser'
                ? 'bg-[#FF0055] text-white brutal-shadow-sm -translate-y-0.5 animate-pulse'
                : 'bg-white hover:bg-neutral-100'
            }`}
            title="Laser Pointer (Temporary Glowing Beam)"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span className="text-xs hidden sm:inline font-heading font-black">Laser</span>
          </button>

          {/* Eraser */}
          <button
            onClick={() => selectTool('eraser')}
            disabled={isDrawingBlocked}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'eraser'
                ? 'bg-[#FF6B00] text-white brutal-shadow-sm -translate-y-0.5'
                : 'bg-white hover:bg-neutral-100'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
            <span className="text-xs hidden sm:inline font-heading font-black">Eraser</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-[2px] bg-black mx-0.5" />

          {/* Shapes Menu Toggle */}
          <button
            onClick={() => selectTool(activeTool === 'rect' ? 'circle' : activeTool === 'circle' ? 'arrow' : activeTool === 'arrow' ? 'line' : 'rect')}
            disabled={isDrawingBlocked}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              ['rect', 'circle', 'arrow', 'line'].includes(activeTool)
                ? 'bg-[#C084FC] brutal-shadow-sm -translate-y-0.5'
                : 'bg-white hover:bg-neutral-100'
            }`}
            title={`Shape Tool: ${activeTool}`}
          >
            {activeTool === 'rect' && <Square className="w-4 h-4" />}
            {activeTool === 'circle' && <Circle className="w-4 h-4" />}
            {activeTool === 'arrow' && <ArrowRight className="w-4 h-4" />}
            {activeTool === 'line' && <Minus className="w-4 h-4" />}
            {!['rect', 'circle', 'arrow', 'line'].includes(activeTool) && <Square className="w-4 h-4" />}
            <span className="text-xs hidden sm:inline font-heading font-black">Shapes</span>
          </button>

          {/* Sticky Note */}
          <button
            onClick={() => {
              onAddStickyNote();
              playSound('pop', canvasSettings.soundEnabled);
            }}
            disabled={isDrawingBlocked}
            className="p-2.5 border-2 border-black font-bold bg-[#FEF08A] hover:bg-[#FDE047] flex items-center gap-1 cursor-pointer transition-all active:translate-y-0.5"
            title="Add Sticky Note"
          >
            <StickyIcon className="w-4 h-4" />
            <span className="text-xs hidden sm:inline font-heading font-black">Note</span>
          </button>

          {/* WHO DREW THIS? Inspector Mode */}
          <button
            onClick={() => selectTool('inspect')}
            className={`p-2.5 border-2 border-black font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTool === 'inspect'
                ? 'bg-[#FFE600] text-black ring-2 ring-black brutal-shadow-sm -translate-y-0.5'
                : 'bg-white hover:bg-[#FFE600]/40'
            }`}
            title="Who Drew This? (Hover or click strokes to reveal author identity & timestamps)"
          >
            <Search className="w-4 h-4 text-black" />
            <span className="text-xs font-heading font-black tracking-tight">Who Drew?</span>
          </button>

          {/* Settings Dialog Trigger */}
          <button
            onClick={() => {
              setShowSettingsModal(true);
              playSound('click', canvasSettings.soundEnabled);
            }}
            className="p-2.5 border-2 border-black font-bold bg-white hover:bg-neutral-100 flex items-center gap-1 cursor-pointer"
            title="Canvas Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Canvas Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-black" />
                <h2 className="font-heading font-black text-xl tracking-tight">Canvas Settings</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 border-2 border-black bg-white hover:bg-red-500 hover:text-white font-bold flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 font-mono text-sm">
              {/* Stroke Smoothing / Stabilizer */}
              <div className="p-3 bg-white border-2 border-black space-y-2">
                <span className="font-heading font-bold block">Stroke Smoothing & Stabilizer</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setCanvasSettings(prev => ({ ...prev, smoothing: level }))}
                      className={`py-1.5 text-xs font-bold border-2 border-black uppercase cursor-pointer ${
                        canvasSettings.smoothing === level ? 'bg-[#FFE600] brutal-shadow-sm' : 'bg-neutral-100 hover:bg-neutral-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Author Color Overlay Mode */}
              <div className="p-3 bg-white border-2 border-black flex items-center justify-between">
                <div>
                  <span className="font-heading font-bold block">Author Attribution Overlay</span>
                  <span className="text-xs text-neutral-600">Colorize all strokes by who drew them</span>
                </div>
                <button
                  onClick={() => setCanvasSettings(prev => ({ ...prev, authorOverlayMode: !prev.authorOverlayMode }))}
                  className={`px-3 py-1 text-xs border-2 border-black font-bold font-mono transition-all cursor-pointer ${
                    canvasSettings.authorOverlayMode ? 'bg-[#00E5FF]' : 'bg-neutral-200'
                  }`}
                >
                  {canvasSettings.authorOverlayMode ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Canvas Background Texture */}
              <div className="p-3 bg-white border-2 border-black space-y-2">
                <span className="font-heading font-bold block">Canvas Background Paper</span>
                <div className="grid grid-cols-4 gap-2">
                  {(['dots', 'lines', 'graph', 'clean'] as const).map((bg) => (
                    <button
                      key={bg}
                      onClick={() => setCanvasSettings(prev => ({ ...prev, background: bg }))}
                      className={`py-1.5 text-xs font-bold border-2 border-black capitalize cursor-pointer ${
                        canvasSettings.background === bg ? 'bg-[#FFE600] brutal-shadow-sm' : 'bg-neutral-100'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Effects */}
              <div className="p-3 bg-white border-2 border-black flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {canvasSettings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-neutral-400" />}
                  <span className="font-heading font-bold">Tactile Sound Effects</span>
                </div>
                <button
                  onClick={() => setCanvasSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                  className={`px-3 py-1 text-xs border-2 border-black font-bold font-mono cursor-pointer ${
                    canvasSettings.soundEnabled ? 'bg-[#A3E635]' : 'bg-neutral-200'
                  }`}
                >
                  {canvasSettings.soundEnabled ? 'ON' : 'MUTED'}
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 bg-[#FFE600] border-3 border-black brutal-shadow font-heading font-black hover:bg-[#FFD600] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
