import React, { useState } from 'react';
import { 
  Undo2, 
  Redo2, 
  Trash2, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Users, 
  MessageSquare, 
  Play, 
  Sparkles,
  Gamepad2,
  PenSquare,
  BarChart2
} from 'lucide-react';
import { RoomUser } from '../types/drawing';
import { playSound } from '../utils/audio';

const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐙', '🐨', '🐸', '🦉', '🦄', '🦖', '🚀', '🎨'];
const USER_COLORS = ['#FF3366', '#3366FF', '#00D26A', '#FF9900', '#9933FF', '#00E5FF', '#FFD600', '#FF3333'];

interface NavbarProps {
  roomId: string;
  roomMode: 'whiteboard' | 'game';
  setRoomMode: (mode: 'whiteboard' | 'game') => void;
  connectionStatus: 'connecting' | 'connected' | 'offline';
  currentUser: RoomUser;
  onUpdateUserProfile: (name: string, avatar: string, color: string) => void;
  users: RoomUser[];
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onOpenExport: () => void;
  onOpenReplay: () => void;
  onOpenStats: () => void;
  onOpenJoinRoom: () => void;
  onOpenShareRoom: () => void;
  onToggleChat: () => void;
  unreadChatCount: number;
  soundEnabled: boolean;
  strokeCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  roomMode,
  setRoomMode,
  connectionStatus,
  currentUser,
  onUpdateUserProfile,
  users,
  onUndo,
  onRedo,
  onClear,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenExport,
  onOpenReplay,
  onOpenStats,
  onOpenJoinRoom,
  onOpenShareRoom,
  onToggleChat,
  unreadChatCount,
  soundEnabled,
  strokeCount
}) => {
  const [copied, setCopied] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Profile edit draft
  const [draftName, setDraftName] = useState(currentUser.name);
  const [draftAvatar, setDraftAvatar] = useState(currentUser.avatar);
  const [draftColor, setDraftColor] = useState(currentUser.color);

  const handleSaveProfile = () => {
    if (draftName.trim()) {
      onUpdateUserProfile(draftName.trim(), draftAvatar, draftColor);
      setShowProfileModal(false);
      playSound('pop', soundEnabled);
    }
  };

  return (
    <header className="fixed top-3 left-3 right-3 z-40 flex items-center justify-between gap-2 pointer-events-none">
      {/* Left Cluster: Logo & Room & Mode Switch */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Brand Badge */}
        <div className="flex items-center gap-2 bg-[#FFE600] border-3 border-black p-2 px-3 brutal-shadow">
          <div className="w-3 h-3 border-2 border-black rounded-full bg-black animate-pulse" />
          <span className="font-heading font-black text-lg tracking-tighter text-black uppercase">
            Inkooginito
          </span>
        </div>

        {/* Mode Selector */}
        <div className="hidden md:flex items-center bg-white border-3 border-black brutal-shadow p-1 gap-1">
          <button
            onClick={() => {
              setRoomMode('whiteboard');
              playSound('click', soundEnabled);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-heading font-black transition-all cursor-pointer ${
              roomMode === 'whiteboard'
                ? 'bg-[#A3E635] border-2 border-black brutal-shadow-sm'
                : 'hover:bg-neutral-100 text-neutral-600'
            }`}
          >
            <PenSquare className="w-3.5 h-3.5" />
            Whiteboard
          </button>
          <button
            onClick={() => {
              setRoomMode('game');
              playSound('click', soundEnabled);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-heading font-black transition-all cursor-pointer ${
              roomMode === 'game'
                ? 'bg-[#FF3366] text-white border-2 border-black brutal-shadow-sm'
                : 'hover:bg-neutral-100 text-neutral-600'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            Fake Artist Game
          </button>
        </div>

        {/* Room Code Badge with Share Modal Trigger */}
        <button
          onClick={() => {
            onOpenShareRoom();
            playSound('pop', soundEnabled);
          }}
          className="flex items-center gap-1.5 bg-white border-3 border-black px-2.5 py-1.5 brutal-shadow hover:bg-[#FFE600]/30 cursor-pointer active:translate-y-0.5"
          title="Click to view Room Code and Invite Link"
        >
          <span className="font-mono text-xs font-bold text-neutral-500">ROOM:</span>
          <span className="font-mono text-xs font-black tracking-wider uppercase text-[#FF3366]">{roomId.slice(0, 6)}</span>
          <Share2 className="w-3.5 h-3.5 text-black ml-0.5" />
        </button>

        {/* Switch / Join Room Button */}
        <button
          onClick={() => {
            onOpenJoinRoom();
            playSound('click', soundEnabled);
          }}
          className="hidden sm:flex items-center gap-1 bg-[#FFFDF5] border-2 border-black px-2 py-1 font-mono text-xs font-bold hover:bg-neutral-200 cursor-pointer"
          title="Switch room or enter a friend's room code"
        >
          <span>Join / Switch</span>
        </button>
      </div>

      {/* Middle Cluster: Quick History & Viewport Navigation */}
      <div className="hidden lg:flex items-center gap-1 bg-white border-3 border-black p-1 brutal-shadow pointer-events-auto">
        <button
          onClick={() => { onUndo(); playSound('click', soundEnabled); }}
          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-neutral-100 cursor-pointer active:translate-y-0.5"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => { onRedo(); playSound('click', soundEnabled); }}
          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-neutral-100 cursor-pointer active:translate-y-0.5"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        
        <div className="h-5 w-[2px] bg-black mx-1" />

        <button
          onClick={() => { onZoomOut(); playSound('click', soundEnabled); }}
          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-neutral-100 cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => { onResetZoom(); playSound('click', soundEnabled); }}
          className="px-2 font-mono text-xs font-bold hover:bg-neutral-100 border-2 border-transparent hover:border-black cursor-pointer"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => { onZoomIn(); playSound('click', soundEnabled); }}
          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-neutral-100 cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-5 w-[2px] bg-black mx-1" />

        <button
          onClick={() => setShowClearConfirm(true)}
          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-100 text-red-600 cursor-pointer"
          title="Clear Entire Canvas"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right Cluster: Collaborators Stack, Replay, Export */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Collaborators Avatar Stack */}
        <div 
          onClick={() => setShowProfileModal(true)}
          className="flex items-center bg-white border-3 border-black p-1 px-2 brutal-shadow cursor-pointer hover:bg-neutral-50"
          title="Click to edit your nickname & avatar"
        >
          <div className="flex -space-x-2 mr-2">
            {users.slice(0, 4).map((u) => (
              <div
                key={u.id}
                style={{ backgroundColor: u.color }}
                className="w-7 h-7 border-2 border-black flex items-center justify-center text-xs font-bold font-mono"
                title={`${u.name} ${u.id === currentUser.id ? '(You)' : ''}`}
              >
                {u.avatar || u.name.charAt(0)}
              </div>
            ))}
            {users.length > 4 && (
              <div className="w-7 h-7 border-2 border-black bg-neutral-200 flex items-center justify-center text-xs font-bold font-mono">
                +{users.length - 4}
              </div>
            )}
          </div>
          <span className="font-heading font-black text-xs hidden sm:inline">
            {currentUser.name} <span className="text-neutral-400 font-mono">(Edit)</span>
          </span>
        </div>

        {/* Timelapse Replay Button */}
        <button
          onClick={() => {
            onOpenReplay();
            playSound('click', soundEnabled);
          }}
          disabled={strokeCount === 0}
          className="hidden sm:flex items-center gap-1.5 bg-[#00E5FF] border-3 border-black px-3 py-1.5 font-heading font-black text-xs brutal-shadow hover:bg-[#38BDF8] active:translate-y-0.5 cursor-pointer disabled:opacity-40"
          title="Watch stroke-by-stroke replay animation"
        >
          <Play className="w-3.5 h-3.5 fill-black" />
          <span>Replay</span>
        </button>

        {/* Stats & Attribution Modal */}
        <button
          onClick={() => {
            onOpenStats();
            playSound('click', soundEnabled);
          }}
          className="hidden sm:flex items-center gap-1.5 bg-white border-3 border-black px-2.5 py-1.5 font-heading font-black text-xs brutal-shadow hover:bg-neutral-100 cursor-pointer"
          title="Canvas Attribution Stats"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Who Drew?</span>
        </button>

        {/* Chat Toggle Button */}
        <button
          onClick={() => {
            onToggleChat();
            playSound('pop', soundEnabled);
          }}
          className="relative bg-white border-3 border-black p-2 brutal-shadow hover:bg-neutral-100 cursor-pointer active:translate-y-0.5"
          title="Open Room Chat"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#FF3366] text-white border-2 border-black font-mono text-[10px] font-black flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Pro Export Suite Trigger */}
        <button
          onClick={() => {
            onOpenExport();
            playSound('pop', soundEnabled);
          }}
          className="flex items-center gap-1.5 bg-[#FFE600] border-3 border-black px-3.5 py-1.5 font-heading font-black text-xs brutal-shadow hover:bg-[#FFD600] active:translate-y-0.5 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span className="tracking-tight">EXPORT</span>
        </button>
      </div>

      {/* User Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b-3 border-black pb-2 mb-4">
              <h2 className="font-heading font-black text-lg">Customize Your Artist Profile</h2>
              <button onClick={() => setShowProfileModal(false)} className="font-bold text-lg hover:text-red-500">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-heading font-bold text-xs block mb-1">Artist Nickname</label>
                <input
                  type="text"
                  maxLength={18}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full p-2 bg-white border-2 border-black font-heading font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-[#FFE600]"
                />
              </div>

              <div>
                <label className="font-heading font-bold text-xs block mb-1">Choose Mascot Avatar</label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((av) => (
                    <button
                      key={av}
                      onClick={() => setDraftAvatar(av)}
                      className={`text-2xl p-1.5 border-2 border-black transition-transform cursor-pointer ${
                        draftAvatar === av ? 'bg-[#FFE600] brutal-shadow-sm scale-110' : 'bg-white hover:bg-neutral-100'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-heading font-bold text-xs block mb-1">Assigned Stroke & Tag Color</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {USER_COLORS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setDraftColor(col)}
                      style={{ backgroundColor: col }}
                      className={`w-7 h-7 border-2 border-black cursor-pointer ${
                        draftColor === col ? 'scale-125 ring-2 ring-black' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-1.5 bg-white border-2 border-black font-heading font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-5 py-1.5 bg-[#A3E635] border-2 border-black brutal-shadow font-heading font-black text-xs cursor-pointer hover:bg-[#86efac]"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Canvas Confirm Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-sm w-full text-center">
            <h2 className="font-heading font-black text-xl mb-2">Clear Entire Canvas?</h2>
            <p className="text-sm font-mono text-neutral-700 mb-6">
              This will erase all strokes for everyone currently in the room. Are you sure?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-white border-2 border-black font-heading font-bold text-sm cursor-pointer"
              >
                Nevermind
              </button>
              <button
                onClick={() => {
                  onClear();
                  setShowClearConfirm(false);
                  playSound('erase', soundEnabled);
                }}
                className="px-5 py-2 bg-[#EF4444] text-white border-3 border-black brutal-shadow font-heading font-black text-sm cursor-pointer hover:bg-red-600"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
