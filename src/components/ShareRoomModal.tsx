import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, QrCode, ExternalLink, X, Users, Smartphone } from 'lucide-react';
import { playSound } from '../utils/audio';

interface ShareRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomMode: 'whiteboard' | 'game';
  soundEnabled: boolean;
}

export const ShareRoomModal: React.FC<ShareRoomModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomMode,
  soundEnabled
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    // Check if navigator.share is supported
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }

    // Fetch server public config (e.g. Cloud Run APP_URL)
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.appUrl && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          setBaseUrl(data.appUrl.replace(/\/$/, ''));
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const shareUrl = `${baseUrl}?room=${roomId}&mode=${roomMode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    playSound('pop', soundEnabled);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    playSound('pop', soundEnabled);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Inkooginito room!',
          text: `Join my real-time collaborative ${roomMode === 'game' ? 'Fake Artist game' : 'whiteboard'} on Inkooginito! Room Code: ${roomId}`,
          url: shareUrl
        });
        playSound('bell', soundEnabled);
      } catch (e) {
        // user cancelled or share failed
      }
    }
  };

  const openSecondPlayerWindow = () => {
    const testUrl = `${shareUrl}&asTestPlayer=1`;
    window.open(testUrl, '_blank', 'width=1100,height=800');
    playSound('bell', soundEnabled);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-lg w-full animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-black" />
            <h2 className="font-heading font-black text-xl tracking-tight uppercase">Invite Friends & Play</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border-2 border-black bg-white hover:bg-red-500 hover:text-white font-bold flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Room Code Big Card */}
        <div className="p-4 bg-white border-3 border-black brutal-shadow-sm mb-4 text-center">
          <span className="font-mono text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1">
            Room Code
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono font-black text-3xl tracking-widest text-[#FF3366]">
              {roomId}
            </span>
            <button
              onClick={copyCode}
              className="p-2 bg-[#FFE600] border-2 border-black brutal-shadow-sm hover:bg-[#FFD600] cursor-pointer"
              title="Copy Room Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <span className="text-[11px] font-mono text-neutral-600 mt-1 block">
            Friends can visit this site and click <strong>"Join / Switch"</strong> to enter this code!
          </span>
        </div>

        {/* Direct Link Card */}
        <div className="p-3 bg-white border-2 border-black mb-3">
          <span className="font-heading font-bold text-xs uppercase text-neutral-600 block mb-1.5">
            Direct Shareable URL
          </span>
          <div className="flex gap-1.5">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 p-2 bg-[#F8F6ED] border-2 border-black font-mono text-xs truncate select-all"
            />
            <button
              onClick={copyUrl}
              className="px-4 py-2 bg-[#A3E635] border-2 border-black brutal-shadow-sm font-heading font-black text-xs hover:bg-[#86efac] active:translate-y-0.5 cursor-pointer flex items-center gap-1 shrink-0"
            >
              {copiedLink ? <Check className="w-4 h-4 text-green-800" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Native App Share Button (if supported) */}
        {canNativeShare && (
          <button
            onClick={handleNativeShare}
            className="w-full mb-3 py-2.5 bg-[#00E5FF] border-2 border-black brutal-shadow-sm font-heading font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-[#38BDF8] active:translate-y-0.5 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            Share via App (WhatsApp, Messages, Discord)
          </button>
        )}

        {/* Split Screen / 2nd Player Window Launcher */}
        <div className="p-3 bg-[#FFE600]/30 border-2 border-black mb-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-heading font-black text-xs block">Test Multiplayer Now</span>
              <span className="font-mono text-[11px] text-neutral-600">
                Open a 2nd player window side-by-side to play right now
              </span>
            </div>
            <button
              onClick={openSecondPlayerWindow}
              className="px-3 py-1.5 bg-[#FFE600] border-2 border-black brutal-shadow-sm font-heading font-black text-xs flex items-center gap-1 hover:bg-[#FFD600] cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Player 2
            </button>
          </div>
        </div>

        {/* QR Code for Mobile Devices */}
        <div className="p-3 bg-white border-2 border-black flex items-center gap-4 mb-4">
          <div className="w-20 h-20 bg-neutral-100 border-2 border-black flex items-center justify-center shrink-0 overflow-hidden">
            <img src={qrUrl} alt="Room QR Code" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-heading font-black text-sm flex items-center gap-1">
              <QrCode className="w-4 h-4" /> Scan with Phone or Tablet
            </div>
            <p className="text-xs font-mono text-neutral-600 mt-0.5">
              Point your camera at this code to join instantly with Apple Pencil or touchscreen pressure support.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#FFE600] border-3 border-black brutal-shadow font-heading font-black text-xs uppercase hover:bg-[#FFD600] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
