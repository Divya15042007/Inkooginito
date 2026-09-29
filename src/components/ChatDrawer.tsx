import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, X, MessageSquare } from 'lucide-react';
import { ChatMessage, RoomUser } from '../types/drawing';
import { playSound } from '../utils/audio';

const REACTION_EMOJIS = ['🔥', '👏', '🎨', '😂', '🤯', '💡', '💯', '🤔'];

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUser: RoomUser;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string, x: number, y: number) => void;
  soundEnabled: boolean;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  currentUser,
  onSendMessage,
  onSendReaction,
  soundEnabled
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
    playSound('pop', soundEnabled);
  };

  const handleReactionClick = (emoji: string) => {
    // Send reaction burst near center of canvas
    const x = window.innerWidth / 2 + (Math.random() * 200 - 100);
    const y = window.innerHeight / 2 + (Math.random() * 200 - 100);
    onSendReaction(emoji, x, y);
    playSound('pop', soundEnabled);
  };

  if (!isOpen) return null;

  return (
    <aside aria-label="Room Chat" className="fixed bottom-24 right-4 z-40 w-80 sm:w-96 bg-[#FFFDF5] border-4 border-black brutal-shadow-xl flex flex-col h-[460px] animate-in slide-in-from-bottom-5 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b-3 border-black bg-[#FFE600]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-black" />
          <h3 className="font-heading font-black text-sm uppercase tracking-tight">Room Chat & Guesses</h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 border-2 border-black bg-white hover:bg-red-500 hover:text-white font-bold flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Reactions Bar */}
      <div className="flex items-center justify-between p-2 bg-white border-b-2 border-black gap-1 overflow-x-auto">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className="text-lg p-1 hover:scale-130 transition-transform cursor-pointer"
            title={`Send ${emoji} burst`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5 font-mono text-xs">
        {messages.length === 0 ? (
          <div className="text-center text-neutral-400 py-10 italic">
            No messages yet. Say hello or share a clue!
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUser.id;
            const isSystem = msg.type === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="p-2 bg-[#FFF9C4] border border-black/40 text-black text-center font-bold text-[11px] brutal-shadow-sm">
                  📢 {msg.text}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="w-2.5 h-2.5 border border-black rounded-full inline-block"
                    style={{ backgroundColor: msg.senderColor }}
                  />
                  <span className="font-heading font-black text-[11px] text-neutral-700">
                    {msg.senderName} {isSelf && '(You)'}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`p-2 border-2 border-black max-w-[85%] break-words brutal-shadow-sm ${
                    isSelf ? 'bg-[#FFE600] text-black font-medium' : 'bg-white text-black'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-2 border-t-3 border-black bg-white flex gap-1.5">
        <input
          type="text"
          placeholder="Message or guess..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 p-2 bg-[#FFFDF5] border-2 border-black font-mono text-xs focus:ring-2 focus:ring-[#FFE600] focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-3 bg-[#A3E635] border-2 border-black brutal-shadow-sm font-heading font-black hover:bg-[#86efac] active:translate-y-0.5 cursor-pointer disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-black" />
        </button>
      </form>
    </aside>
  );
};
