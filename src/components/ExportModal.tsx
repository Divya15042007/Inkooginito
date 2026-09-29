import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  Image as ImageIcon, 
  FileCode, 
  FileText, 
  Sparkles, 
  Share2 
} from 'lucide-react';
import { Stroke, CanvasBackground } from '../types/drawing';
import { renderStroke, exportToSVG } from '../utils/stroke';
import { playSound } from '../utils/audio';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  strokes: Stroke[];
  canvasBackground: CanvasBackground;
  soundEnabled: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  strokes,
  canvasBackground,
  soundEnabled
}) => {
  const [scale, setScale] = useState<1 | 2 | 4>(2);
  const [transparentBg, setTransparentBg] = useState(false);
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate bounding box of all strokes so exports are neatly cropped or centered
  const getCanvasBounds = () => {
    if (strokes.length === 0) return { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };

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

    const padding = 60;
    minX = Math.floor(minX - padding);
    minY = Math.floor(minY - padding);
    maxX = Math.ceil(maxX + padding);
    maxY = Math.ceil(maxY + padding);

    const width = Math.max(600, maxX - minX);
    const height = Math.max(400, maxY - minY);

    return { minX, minY, maxX, maxY, width, height };
  };

  // Generate rendered canvas for export
  const renderExportCanvas = (exportScale: number, isTransparent: boolean): HTMLCanvasElement => {
    const bounds = getCanvasBounds();
    const canvas = document.createElement('canvas');
    canvas.width = bounds.width * exportScale;
    canvas.height = bounds.height * exportScale;
    const ctx = canvas.getContext('2d')!;

    ctx.scale(exportScale, exportScale);
    ctx.translate(-bounds.minX, -bounds.minY);

    // Background
    if (!isTransparent) {
      ctx.fillStyle = '#FFFDF5';
      ctx.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

      if (canvasBackground === 'dots') {
        ctx.fillStyle = '#d4d4d8';
        for (let x = bounds.minX; x < bounds.maxX; x += 24) {
          for (let y = bounds.minY; y < bounds.maxY; y += 24) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Render strokes
    strokes.forEach(s => renderStroke(ctx, s));

    // Attribution watermark
    if (includeWatermark) {
      ctx.save();
      const distinctAuthors = Array.from(new Set(strokes.map(s => s.authorName)));
      const label = `Inkooginito · Collaborators: ${distinctAuthors.join(', ')}`;
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText(label, bounds.minX + 20, bounds.maxY - 20);
      ctx.restore();
    }

    return canvas;
  };

  // Generate live preview thumbnail
  useEffect(() => {
    if (!isOpen) return;
    const canvas = renderExportCanvas(1, transparentBg);
    setPreviewUrl(canvas.toDataURL('image/png'));
  }, [isOpen, strokes, transparentBg, includeWatermark, canvasBackground]);

  // Export handlers
  const handleDownloadPNG = () => {
    const canvas = renderExportCanvas(scale, transparentBg);
    const link = document.createElement('a');
    link.download = `whodrew-artwork-${Date.now()}-${scale}x.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    playSound('bell', soundEnabled);
  };

  const handleDownloadJPEG = () => {
    const canvas = renderExportCanvas(scale, false);
    const link = document.createElement('a');
    link.download = `whodrew-artwork-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    playSound('bell', soundEnabled);
  };

  const handleDownloadSVG = () => {
    const bounds = getCanvasBounds();
    const bg = transparentBg ? 'transparent' : '#FFFDF5';
    const svgData = exportToSVG(strokes, bounds.width, bounds.height, bg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `whodrew-artwork-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    playSound('bell', soundEnabled);
  };

  const handleDownloadJSON = () => {
    const projectData = {
      version: 1,
      appName: 'Inkooginito',
      exportedAt: new Date().toISOString(),
      strokes,
      strokeCount: strokes.length,
      authors: Array.from(new Set(strokes.map(s => ({ id: s.authorId, name: s.authorName, color: s.authorColor }))))
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `whodrew-project-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    playSound('pop', soundEnabled);
  };

  const handleCopyToClipboard = async () => {
    try {
      const canvas = renderExportCanvas(scale, transparentBg);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopied(true);
        playSound('pop', soundEnabled);
        setTimeout(() => setCopied(false), 2000);
      }, 'image/png');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
      <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Download className="w-6 h-6 text-black" />
            <h2 className="font-heading font-black text-2xl tracking-tight uppercase">Export Suite</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border-2 border-black bg-white hover:bg-red-500 hover:text-white font-bold flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Thumbnail Preview Card */}
        <div className="border-3 border-black p-3 bg-white mb-5 brutal-shadow-sm flex flex-col items-center">
          <div className="text-[10px] font-mono uppercase font-black text-neutral-500 mb-2 self-start">
            Artwork Preview ({strokes.length} strokes)
          </div>
          <div className="w-full h-44 bg-[#F8F6ED] border-2 border-black flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img src={previewUrl} alt="Export preview" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="font-mono text-xs text-neutral-400">Rendering preview...</span>
            )}
          </div>
        </div>

        {/* Customization Options */}
        <div className="space-y-4 font-mono text-xs mb-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Resolution Scaling */}
            <div className="p-3 bg-white border-2 border-black space-y-2">
              <span className="font-heading font-black text-sm block">Resolution Scale</span>
              <div className="grid grid-cols-3 gap-1">
                {([1, 2, 4] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`py-1.5 border-2 border-black font-bold cursor-pointer ${
                      scale === s ? 'bg-[#FFE600] brutal-shadow-sm' : 'bg-neutral-100 hover:bg-neutral-200'
                    }`}
                  >
                    {s}x {s === 2 ? 'HD' : s === 4 ? '4K' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Options */}
            <div className="p-3 bg-white border-2 border-black space-y-2">
              <span className="font-heading font-black text-sm block">Background</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setTransparentBg(false)}
                  className={`flex-1 py-1.5 border-2 border-black font-bold cursor-pointer ${
                    !transparentBg ? 'bg-[#A3E635] brutal-shadow-sm' : 'bg-neutral-100'
                  }`}
                >
                  Solid Canvas
                </button>
                <button
                  onClick={() => setTransparentBg(true)}
                  className={`flex-1 py-1.5 border-2 border-black font-bold cursor-pointer ${
                    transparentBg ? 'bg-[#00E5FF] brutal-shadow-sm' : 'bg-neutral-100'
                  }`}
                >
                  Transparent
                </button>
              </div>
            </div>
          </div>

          {/* Watermark toggle */}
          <div className="p-3 bg-white border-2 border-black flex items-center justify-between">
            <div>
              <span className="font-heading font-bold text-sm block">Artist Credit Stamp</span>
              <span className="text-neutral-500 text-[11px]">Include collaborator names watermark</span>
            </div>
            <button
              onClick={() => setIncludeWatermark(!includeWatermark)}
              className={`px-3 py-1 text-xs border-2 border-black font-bold cursor-pointer ${
                includeWatermark ? 'bg-[#FFE600]' : 'bg-neutral-200'
              }`}
            >
              {includeWatermark ? 'YES' : 'NO'}
            </button>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-heading font-black text-sm">
          {/* PNG High Res */}
          <button
            onClick={handleDownloadPNG}
            className="p-3 bg-[#FFE600] border-3 border-black brutal-shadow hover:bg-[#FFD600] flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5"
          >
            <ImageIcon className="w-4 h-4" />
            Download PNG ({scale}x)
          </button>

          {/* Copy to Clipboard */}
          <button
            onClick={handleCopyToClipboard}
            className="p-3 bg-[#A3E635] border-3 border-black brutal-shadow hover:bg-[#86efac] flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5"
          >
            {copied ? <Check className="w-4 h-4 text-green-800" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Image!' : 'Copy to Clipboard'}
          </button>

          {/* Vector SVG */}
          <button
            onClick={handleDownloadSVG}
            className="p-3 bg-[#00E5FF] border-3 border-black brutal-shadow hover:bg-[#38BDF8] flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5"
          >
            <FileCode className="w-4 h-4" />
            Export Vector SVG
          </button>

          {/* JPEG */}
          <button
            onClick={handleDownloadJPEG}
            className="p-3 bg-white border-3 border-black brutal-shadow hover:bg-neutral-100 flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5"
          >
            <ImageIcon className="w-4 h-4" />
            Download JPEG
          </button>

          {/* JSON Project Backup */}
          <button
            onClick={handleDownloadJSON}
            className="sm:col-span-2 p-2.5 bg-[#FFFDF5] border-2 border-black hover:bg-neutral-100 flex items-center justify-center gap-2 cursor-pointer font-mono text-xs font-bold"
          >
            <FileText className="w-3.5 h-3.5" />
            Backup Raw Project (.json)
          </button>
        </div>
      </div>
    </div>
  );
};
