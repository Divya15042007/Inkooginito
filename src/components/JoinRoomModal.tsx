import React, { useState, useEffect } from 'react';
import { LogIn, Plus, Users, Hash, RefreshCw, X } from 'lucide-react';
import { playSound } from '../utils/audio';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  onJoinRoom: (newRoomId: string) => void;
  soundEnabled: boolean;
}

interface PublicRoom {
  id: string;
  name: string;
  mode: 'whiteboard' | 'game';
  playerCount: number;
  strokeCount: number;
  createdAt: number;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onJoinRoom,
  soundEnabled
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codeInput.trim().toUpperCase();
    if (clean) {
      onJoinRoom(clean);
      onClose();
      playSound('pop', soundEnabled);
    }
  };

  const handleCreateNewRoom = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = '';
    for (let i = 0; i < 6; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onJoinRoom(newCode);
    onClose();
    playSound('bell', soundEnabled);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-md w-full animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-black" />
            <h2 className="font-heading font-black text-xl tracking-tight uppercase">Join or Switch Room</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border-2 border-black bg-white hover:bg-red-500 hover:text-white font-bold flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Enter Code Directly */}
        <form onSubmit={handleJoinByCode} className="mb-5 space-y-2">
          <label className="font-heading font-bold text-xs uppercase block text-neutral-600">
            Enter 6-Letter Room Code
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                maxLength={10}
                placeholder="e.g. 7X9K2P"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="w-full pl-9 p-2.5 bg-white border-2 border-black font-mono font-black text-base uppercase tracking-widest focus:outline-hidden focus:ring-2 focus:ring-[#FFE600]"
              />
            </div>
            <button
              type="submit"
              disabled={!codeInput.trim()}
              className="px-4 py-2 bg-[#A3E635] border-2 border-black brutal-shadow-sm font-heading font-black text-xs uppercase hover:bg-[#86efac] active:translate-y-0.5 cursor-pointer disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </form>

        {/* Or Create New Room */}
        <div className="mb-5">
          <button
            onClick={handleCreateNewRoom}
            className="w-full py-2.5 bg-[#FFE600] border-2 border-black brutal-shadow-sm font-heading font-black text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-[#FFD600] active:translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Brand New Room
          </button>
        </div>

        {/* Public Rooms List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-heading font-bold text-xs uppercase text-neutral-600">
              Active Rooms on Server
            </span>
            <button
              onClick={fetchRooms}
              className="text-neutral-500 hover:text-black transition-colors"
              title="Refresh Room List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {publicRooms.length === 0 ? (
              <div className="p-4 bg-white border-2 border-black text-center font-mono text-xs text-neutral-400">
                No other active rooms currently. Share your room code!
              </div>
            ) : (
              publicRooms.map((r) => {
                const isCurrent = r.id === currentRoomId;
                return (
                  <div
                    key={r.id}
                    className={`p-2.5 border-2 border-black flex items-center justify-between font-mono text-xs ${
                      isCurrent ? 'bg-[#FFE600]/40 border-dashed' : 'bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div>
                      <div className="font-heading font-black text-sm flex items-center gap-1.5">
                        <span>{r.name}</span>
                        <span className="text-[10px] font-mono px-1 border border-black bg-neutral-100">
                          {r.mode}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <Users className="w-3 h-3" /> {r.playerCount} online
                        </span>
                        <span>·</span>
                        <span>{r.strokeCount} strokes</span>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="text-[10px] font-black font-mono bg-black text-white px-2 py-0.5">
                        HERE
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onJoinRoom(r.id);
                          onClose();
                          playSound('pop', soundEnabled);
                        }}
                        className="px-3 py-1 bg-white border-2 border-black font-heading font-black text-xs hover:bg-[#A3E635] cursor-pointer"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
