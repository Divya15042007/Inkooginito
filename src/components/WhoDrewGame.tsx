import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Users, 
  Clock, 
  Crown, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Vote, 
  AlertTriangle, 
  Trophy, 
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  Bot,
  Plus,
  Dices,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RoomUser, GameState } from '../types/drawing';
import { playSound } from '../utils/audio';

const FALLBACK_CATEGORIES: Record<string, string[]> = {
  Animals: ['Elephant', 'Giraffe', 'Penguin', 'Chameleon', 'Octopus', 'Kangaroo', 'Flamingo', 'Hedgehog', 'Dolphin', 'Panda'],
  Food: ['Pizza Slice', 'Sushi Roll', 'Taco', 'Ice Cream Cone', 'Hamburger', 'Croissant', 'Pancake Stack', 'Avocado', 'Watermelon', 'Cupcake'],
  Objects: ['Submarine', 'Hot Air Balloon', 'Telescope', 'Guitar', 'Microscope', 'Hourglass', 'Skateboard', 'Compass', 'Boombox', 'Umbrella'],
  Places: ['Eiffel Tower', 'Pyramids of Giza', 'Statue of Liberty', 'Volcano', 'Haunted House', 'Desert Island', 'Lighthouse', 'Space Station', 'Castle', 'Igloo'],
  Activities: ['Scuba Diving', 'Bungee Jumping', 'Baking Cookies', 'Playing Chess', 'Surfing', 'Astronaut Spacewalk', 'Painting a Canvas', 'Karaoke', 'Gardening', 'Yoga'],
  Cinema: ['Darth Vader', 'Lightsaber', 'Popcorn Bucket', 'Film Reel', 'Oscar Trophy', 'Superhero Cape', 'DeLorean Car', 'Wizard Wand', 'Alien UFO'],
  Space: ['Saturn Ring', 'Black Hole', 'Shooting Star', 'Lunar Rover', 'Satellite Dish', 'Solar Eclipse', 'Astronaut Helmet', 'Alien Planet', 'Space Rocket']
};

interface WhoDrewGameProps {
  gameState: GameState;
  currentUser: RoomUser;
  users: RoomUser[];
  onStartGame: (category?: string, word?: string, rounds?: number, turnTime?: number) => void;
  onEndTurn: () => void;
  onStartVoting: () => void;
  onSubmitVote: (targetUserId: string) => void;
  onSubmitForgerGuess: (guess: string) => void;
  onResetGame: () => void;
  onOpenShareRoom?: () => void;
  onAddBot?: () => void;
  onRemoveBot?: (botId: string) => void;
  soundEnabled: boolean;
}

export const WhoDrewGame: React.FC<WhoDrewGameProps> = ({
  gameState,
  currentUser,
  users,
  onStartGame,
  onEndTurn,
  onStartVoting,
  onSubmitVote,
  onSubmitForgerGuess,
  onResetGame,
  onOpenShareRoom,
  onAddBot,
  onRemoveBot,
  soundEnabled
}) => {
  // Category & Word State from API
  const [categories, setCategories] = useState<Record<string, string[]>>(FALLBACK_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>('Animals');
  const [customWord, setCustomWord] = useState<string>('');
  const [useCustomWord, setUseCustomWord] = useState<boolean>(false);
  const [rounds, setRounds] = useState<number>(2);
  const [turnTime, setTurnTime] = useState<number>(30);

  // Custom Category Creator Dialog
  const [showAddCustomModal, setShowAddCustomModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryWords, setNewCategoryWords] = useState<string>('');

  // In-Game UI states
  const [isRoleCardRevealed, setIsRoleCardRevealed] = useState<boolean>(false);
  const [votedPlayerId, setVotedPlayerId] = useState<string | null>(null);
  const [forgerInputGuess, setForgerInputGuess] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(gameState.turnTimeLimit);

  // Fetch live categories from server
  useEffect(() => {
    fetch('/api/words')
      .then(res => res.json())
      .then(data => {
        if (data.categories && Object.keys(data.categories).length > 0) {
          setCategories(data.categories);
          if (!data.categories[selectedCategory]) {
            setSelectedCategory(Object.keys(data.categories)[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Timer countdown
  useEffect(() => {
    if (gameState.phase !== 'drawing' && gameState.phase !== 'discussion') return;

    setTimeLeft(gameState.turnTimeLimit);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (gameState.phase === 'drawing' && isCurrentTurnPlayer) {
            onEndTurn();
          }
          return 0;
        }
        if (prev <= 6 && soundEnabled) {
          playSound('timer', true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.phase, gameState.currentTurnIndex, gameState.currentRound]);

  // Trigger celebration on game over
  useEffect(() => {
    if (gameState.phase === 'game_over') {
      playSound('victory', soundEnabled);
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // confetti fallback
      }
    }
  }, [gameState.phase]);

  const currentTurnUserId = gameState.playerOrder[gameState.currentTurnIndex];
  const currentTurnUser = users.find(u => u.id === currentTurnUserId);
  const isCurrentTurnPlayer = currentTurnUserId === currentUser.id;
  const isFakeArtist = currentUser.role === 'fake_artist' || (gameState.phase === 'forger_guess' && gameState.fakeArtistId === currentUser.id);

  // Fetch random word helper
  const handleRollRandomWord = async () => {
    try {
      const res = await fetch(`/api/words/random?category=${encodeURIComponent(selectedCategory)}`);
      if (res.ok) {
        const data = await res.json();
        setUseCustomWord(true);
        setCustomWord(data.word);
        playSound('pop', soundEnabled);
      }
    } catch (e) {
      const words = categories[selectedCategory] || [];
      if (words.length > 0) {
        setUseCustomWord(true);
        setCustomWord(words[Math.floor(Math.random() * words.length)]);
      }
    }
  };

  // Submit custom category
  const handleSaveCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = newCategoryName.trim();
    const words = newCategoryWords.split(/,|\n/).map(w => w.trim()).filter(Boolean);

    if (!cat || words.length === 0) return;

    try {
      const res = await fetch('/api/words/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, words })
      });
      if (res.ok) {
        setCategories(prev => ({ ...prev, [cat]: words }));
        setSelectedCategory(cat);
        setShowAddCustomModal(false);
        setNewCategoryName('');
        setNewCategoryWords('');
        playSound('bell', soundEnabled);
      }
    } catch (e) {
      // Local fallback
      setCategories(prev => ({ ...prev, [cat]: words }));
      setSelectedCategory(cat);
      setShowAddCustomModal(false);
    }
  };

  // 1. TOP STATUS BANNER (DURING ACTIVE DRAWING)
  if (gameState.phase === 'drawing') {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-xl w-full px-4 pointer-events-none">
        <div className="w-full bg-[#FFFDF5] border-3 border-black brutal-shadow-lg p-3 flex items-center justify-between pointer-events-auto">
          {/* Turn and Round indicator */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 border-2 border-black flex items-center justify-center text-lg font-bold brutal-shadow-sm"
              style={{ backgroundColor: currentTurnUser?.color || '#FFE600' }}
            >
              {currentTurnUser?.avatar || '🎨'}
            </div>
            <div>
              <div className="font-heading font-black text-sm flex items-center gap-1.5">
                {isCurrentTurnPlayer ? (
                  <span className="text-[#FF3366] animate-pulse">YOUR TURN TO DRAW!</span>
                ) : (
                  <span>{currentTurnUser?.name}'s Turn</span>
                )}
                <span className="text-[10px] font-mono bg-neutral-200 border border-black px-1.5 py-0.2">
                  R{gameState.currentRound}/{gameState.maxRounds}
                </span>
                {currentTurnUser?.isBot && (
                  <span className="text-[10px] font-mono bg-[#00E5FF] border border-black px-1">BOT</span>
                )}
              </div>
              <div className="text-xs font-mono text-neutral-600">
                {isCurrentTurnPlayer
                  ? 'Draw 1 continuous line to prove you know the word!'
                  : currentTurnUser?.isBot ? 'Bot is creating a stroke...' : 'Watch closely to spot who is bluffing...'}
              </div>
            </div>
          </div>

          {/* Timer & Turn End */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 font-mono font-black text-lg px-2.5 py-1 border-2 border-black ${
              timeLeft <= 5 ? 'bg-red-500 text-white animate-bounce' : 'bg-white'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{timeLeft}s</span>
            </div>

            {isCurrentTurnPlayer && (
              <button
                onClick={() => {
                  onEndTurn();
                  playSound('bell', soundEnabled);
                }}
                className="px-3 py-1.5 bg-[#A3E635] border-2 border-black brutal-shadow-sm font-heading font-black text-xs hover:bg-[#86efac] active:translate-y-0.5 cursor-pointer"
              >
                Done Drawing
              </button>
            )}
          </div>
        </div>

        {/* Secret Word Card Pill for Current Player */}
        <div className="pointer-events-auto">
          <button
            onClick={() => setIsRoleCardRevealed(!isRoleCardRevealed)}
            className="flex items-center gap-2 px-3 py-1 bg-white border-2 border-black brutal-shadow-sm text-xs font-mono font-bold cursor-pointer hover:bg-neutral-50"
          >
            {isRoleCardRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>
              {isRoleCardRevealed
                ? (isFakeArtist ? 'YOU ARE THE FAKE ARTIST (Blend in!)' : `Secret: ${gameState.secretWord} (${gameState.category})`)
                : 'Click to Reveal Secret Word'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // 2. DISCUSSION PHASE
  if (gameState.phase === 'discussion') {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 max-w-lg w-full px-4 pointer-events-none">
        <div className="bg-[#FFFDF5] border-3 border-black brutal-shadow-lg p-4 pointer-events-auto text-center space-y-3">
          <div className="inline-block px-3 py-1 bg-[#FFE600] border-2 border-black font-heading font-black text-xs uppercase brutal-shadow-sm">
            Phase: Discussion & Canvas Inspection
          </div>
          <h2 className="font-heading font-black text-xl">All Strokes Have Been Drawn!</h2>
          <p className="text-xs font-mono text-neutral-700">
            Use the <strong>"Who Drew?"</strong> inspector tool to examine each stroke. Debate with players in chat and determine who drew without knowing the secret word!
          </p>

          <button
            onClick={() => {
              onStartVoting();
              playSound('bell', soundEnabled);
            }}
            className="w-full py-2.5 bg-[#FF3366] text-white border-3 border-black brutal-shadow font-heading font-black text-sm hover:bg-[#F43F5E] cursor-pointer active:translate-y-0.5"
          >
            Start Voting Ballot
          </button>
        </div>
      </div>
    );
  }

  // 3. VOTING PHASE
  if (gameState.phase === 'voting') {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-md w-full animate-in zoom-in-95">
          <div className="text-center mb-5">
            <div className="inline-block px-3 py-1 bg-[#FF3366] text-white border-2 border-black font-heading font-black text-xs uppercase brutal-shadow-sm mb-2">
              CAST YOUR VOTE
            </div>
            <h2 className="font-heading font-black text-2xl">Who is the Fake Artist?</h2>
            <p className="text-xs font-mono text-neutral-600 mt-1">
              Select the player whose strokes look most suspicious or vague.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              const isSelected = votedPlayerId === u.id;

              return (
                <button
                  key={u.id}
                  disabled={isSelf}
                  onClick={() => {
                    setVotedPlayerId(u.id);
                    playSound('click', soundEnabled);
                  }}
                  className={`p-3 border-2 border-black text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelf ? 'opacity-40 cursor-not-allowed bg-neutral-100' :
                    isSelected ? 'bg-[#FFE600] brutal-shadow scale-102 ring-2 ring-black' :
                    'bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div
                    className="w-8 h-8 border-2 border-black flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.avatar}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-heading font-black text-sm truncate flex items-center gap-1">
                      {u.name}
                      {u.isBot && <span className="text-[9px] bg-[#00E5FF] px-1 border border-black">BOT</span>}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-500">
                      {isSelf ? '(You)' : 'Accuse Player'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            disabled={!votedPlayerId}
            onClick={() => {
              if (votedPlayerId) {
                onSubmitVote(votedPlayerId);
                playSound('pop', soundEnabled);
              }
            }}
            className="w-full py-3 bg-[#A3E635] border-3 border-black brutal-shadow font-heading font-black text-base hover:bg-[#86efac] active:translate-y-0.5 cursor-pointer disabled:opacity-40"
          >
            Confirm Accusation
          </button>
        </div>
      </div>
    );
  }

  // 4. FORGER GUESS PHASE
  if (gameState.phase === 'forger_guess') {
    const isCurrentForger = currentUser.id === gameState.fakeArtistId;
    const forgerUser = users.find(u => u.id === gameState.fakeArtistId);

    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-md w-full text-center animate-in zoom-in-95">
          <div className="inline-block px-3 py-1 bg-[#EF4444] text-white border-2 border-black font-heading font-black text-xs uppercase mb-3 brutal-shadow-sm">
            ⚠️ FAKE ARTIST IDENTIFIED!
          </div>

          <h2 className="font-heading font-black text-2xl mb-2">The Forger Was Caught!</h2>
          <p className="text-xs font-mono text-neutral-700 mb-6">
            Category was: <strong>{gameState.category}</strong>. The Fake Artist ({forgerUser?.name}) has ONE final chance to guess the secret word and steal the game!
          </p>

          {isCurrentForger ? (
            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Type your guess here..."
                value={forgerInputGuess}
                onChange={(e) => setForgerInputGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && forgerInputGuess.trim()) {
                    onSubmitForgerGuess(forgerInputGuess.trim());
                  }
                }}
                className="w-full p-3 bg-white border-3 border-black font-heading font-black text-center text-lg focus:outline-hidden focus:ring-2 focus:ring-[#FFE600]"
              />
              <button
                disabled={!forgerInputGuess.trim()}
                onClick={() => onSubmitForgerGuess(forgerInputGuess.trim())}
                className="w-full py-3 bg-[#FFE600] border-3 border-black brutal-shadow font-heading font-black text-base hover:bg-[#FFD600] cursor-pointer"
              >
                Submit Final Word Guess
              </button>
            </div>
          ) : (
            <div className="p-4 bg-white border-2 border-black font-mono text-sm">
              Waiting for the Fake Artist to enter their last-chance word guess...
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. GAME OVER & PODIUM
  if (gameState.phase === 'game_over') {
    const isArtistsWin = gameState.winner === 'artists';

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-lg w-full text-center animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
          <div className={`inline-block px-4 py-1.5 border-3 border-black font-heading font-black text-sm uppercase mb-3 brutal-shadow ${
            isArtistsWin ? 'bg-[#A3E635]' : 'bg-[#FF3366] text-white'
          }`}>
            🏆 {isArtistsWin ? 'GENUINE ARTISTS WIN!' : 'FAKE ARTIST WINS!'}
          </div>

          <h2 className="font-heading font-black text-3xl tracking-tight mb-2">
            Match Results
          </h2>

          <div className="p-4 bg-white border-3 border-black brutal-shadow-sm mb-5 text-left font-mono text-xs space-y-2">
            <div className="flex justify-between border-b-2 border-black/10 pb-1">
              <span className="text-neutral-500">Secret Word:</span>
              <span className="font-heading font-black text-sm text-black">{gameState.secretWord}</span>
            </div>
            <div className="flex justify-between border-b-2 border-black/10 pb-1">
              <span className="text-neutral-500">Category:</span>
              <span className="font-bold text-black">{gameState.category}</span>
            </div>
            <div className="flex justify-between border-b-2 border-black/10 pb-1">
              <span className="text-neutral-500">The Fake Artist:</span>
              <span className="font-heading font-black text-sm text-[#FF3366]">
                {users.find(u => u.id === gameState.fakeArtistId)?.name || 'Forger'}
              </span>
            </div>
            <p className="pt-2 text-neutral-800 font-sans italic">
              {gameState.winReason}
            </p>
          </div>

          {/* Scores Table */}
          <div className="mb-6">
            <span className="font-heading font-black text-xs uppercase block text-left mb-2">Current Leaderboard</span>
            <div className="grid grid-cols-2 gap-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 bg-white border-2 border-black font-mono text-xs">
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{u.avatar}</span>
                    <span className="font-bold">{u.name}</span>
                  </span>
                  <span className="font-black bg-[#FFE600] px-1.5 py-0.5 border border-black">{u.score} pts</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              onResetGame();
              playSound('click', soundEnabled);
            }}
            className="w-full py-3 bg-[#FFE600] border-3 border-black brutal-shadow font-heading font-black text-base hover:bg-[#FFD600] active:translate-y-0.5 cursor-pointer"
          >
            Play Another Round
          </button>
        </div>
      </div>
    );
  }

  // 6. LOBBY SCREEN
  const activeUsers = users.filter(u => u.connected !== false);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center p-4">
      <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-lg w-full pointer-events-auto max-h-[88vh] overflow-y-auto">
        <div className="flex items-center gap-2 border-b-3 border-black pb-3 mb-4">
          <Gamepad2 className="w-6 h-6 text-[#FF3366]" />
          <div>
            <h2 className="font-heading font-black text-xl tracking-tight">Who is the Fake Artist?</h2>
            <p className="text-xs font-mono text-neutral-500">Real-time social deduction drawing match</p>
          </div>
        </div>

        {/* How to play brief */}
        <div className="p-3 bg-white border-2 border-black mb-4 font-mono text-xs space-y-1">
          <p>🎨 <strong>Real Artists</strong> see the secret word and draw 1 stroke per turn.</p>
          <p>🎭 <strong>1 Fake Artist</strong> only sees the category and bluffs to blend in!</p>
          <p>🔍 Spot the fake without revealing the exact word to them.</p>
        </div>

        {/* Players in Lobby */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-heading font-black text-xs uppercase">
              Players in Room ({activeUsers.length})
            </span>
            {activeUsers.length < 2 && (
              <span className="text-[11px] font-mono text-red-600 font-bold">Need min 2 players</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {activeUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 bg-white border-2 border-black font-mono text-xs">
                <div className="flex items-center gap-2 truncate">
                  <div
                    className="w-6 h-6 border border-black flex items-center justify-center font-bold shrink-0"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.avatar}
                  </div>
                  <span className="font-bold truncate">{u.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {u.isHost && (
                    <span title="Room Host">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                    </span>
                  )}
                  {u.isBot && onRemoveBot && (
                    <button
                      onClick={() => onRemoveBot(u.id)}
                      className="text-neutral-400 hover:text-red-500"
                      title="Remove Bot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Invite & Bot Action Buttons */}
          <div className="flex gap-2">
            {onOpenShareRoom && (
              <button
                onClick={() => {
                  onOpenShareRoom();
                  playSound('pop', soundEnabled);
                }}
                className="flex-1 py-2 bg-[#00E5FF] border-2 border-black brutal-shadow-sm font-heading font-black text-xs flex items-center justify-center gap-1.5 hover:bg-[#38BDF8] cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Invite Friends (Link & QR)
              </button>
            )}

            {onAddBot && (
              <button
                onClick={() => {
                  onAddBot();
                  playSound('pop', soundEnabled);
                }}
                className="px-3 py-2 bg-[#FFE600] border-2 border-black brutal-shadow-sm font-heading font-black text-xs flex items-center justify-center gap-1 hover:bg-[#FFD600] cursor-pointer shrink-0"
                title="Add Practice Player to test or play solo"
              >
                <Bot className="w-3.5 h-3.5" />
                Add Practice Bot
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Category Picker */}
        <div className="mb-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-heading font-black text-xs uppercase">Choose Category</span>
            <button
              onClick={() => setShowAddCustomModal(true)}
              className="text-[11px] font-mono font-bold flex items-center gap-1 text-black hover:text-[#FF3366] cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Custom Wordpack
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {Object.keys(categories).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setUseCustomWord(false);
                }}
                className={`py-1.5 text-xs font-bold border-2 border-black truncate px-1 cursor-pointer ${
                  !useCustomWord && selectedCategory === cat ? 'bg-[#FFE600] brutal-shadow-sm font-black' : 'bg-white hover:bg-neutral-100'
                }`}
                title={cat}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Word / Random Word Tool */}
        <div className="mb-4 p-3 bg-white border-2 border-black space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-mono font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomWord}
                onChange={(e) => setUseCustomWord(e.target.checked)}
                className="accent-black w-4 h-4 cursor-pointer"
              />
              <span>Use Specific Secret Word</span>
            </label>

            <button
              onClick={handleRollRandomWord}
              className="flex items-center gap-1 text-[11px] font-mono font-bold bg-[#FFFDF5] border border-black px-2 py-0.5 hover:bg-[#FFE600] cursor-pointer"
              title="Roll a random word from category"
            >
              <Dices className="w-3.5 h-3.5" />
              Randomize
            </button>
          </div>

          {useCustomWord && (
            <input
              type="text"
              placeholder="e.g. Rollercoaster, Eiffel Tower"
              value={customWord}
              onChange={(e) => setCustomWord(e.target.value)}
              className="w-full p-2 bg-[#F8F6ED] border-2 border-black font-mono text-xs focus:ring-2 focus:ring-[#FFE600] focus:outline-hidden"
            />
          )}
        </div>

        {/* Match Settings: Rounds & Turn Time */}
        <div className="grid grid-cols-2 gap-2 mb-6 font-mono text-xs">
          <div className="p-2 bg-white border-2 border-black">
            <span className="block font-bold text-neutral-500 mb-1">Rounds per Match:</span>
            <div className="flex gap-1">
              {[1, 2, 3].map(r => (
                <button
                  key={r}
                  onClick={() => setRounds(r)}
                  className={`flex-1 py-1 border border-black font-bold cursor-pointer ${
                    rounds === r ? 'bg-[#A3E635]' : 'bg-neutral-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 bg-white border-2 border-black">
            <span className="block font-bold text-neutral-500 mb-1">Turn Timer:</span>
            <div className="flex gap-1">
              {[15, 30, 45].map(t => (
                <button
                  key={t}
                  onClick={() => setTurnTime(t)}
                  className={`flex-1 py-1 border border-black font-bold cursor-pointer ${
                    turnTime === t ? 'bg-[#A3E635]' : 'bg-neutral-100'
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Start Game Action */}
        <button
          disabled={activeUsers.length < 2}
          onClick={() => {
            const word = useCustomWord && customWord.trim() ? customWord.trim() : undefined;
            onStartGame(selectedCategory, word, rounds, turnTime);
            playSound('bell', soundEnabled);
          }}
          className="w-full py-3 bg-[#FFE600] border-3 border-black brutal-shadow font-heading font-black text-base hover:bg-[#FFD600] active:translate-y-0.5 cursor-pointer disabled:opacity-40"
        >
          {activeUsers.length < 2 ? 'Add a Bot or Invite Friends to Start' : 'Start Match!'}
        </button>
      </div>

      {/* Add Custom Category & Wordpack Modal */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <h3 className="font-heading font-black text-base">Create Custom Wordpack</h3>
              <button onClick={() => setShowAddCustomModal(false)} className="font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveCustomCategory} className="space-y-3 font-mono text-xs">
              <div>
                <label className="font-bold block mb-1">Category Title</label>
                <input
                  type="text"
                  placeholder="e.g. Anime Heroes, Hogwarts, Tech"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full p-2 bg-white border-2 border-black font-bold"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Words (comma or newline separated)</label>
                <textarea
                  rows={4}
                  placeholder="Naruto, Goku, Luffy, Saitama"
                  value={newCategoryWords}
                  onChange={(e) => setNewCategoryWords(e.target.value)}
                  className="w-full p-2 bg-white border-2 border-black font-mono text-xs"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-3 py-1.5 bg-white border-2 border-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#A3E635] border-2 border-black font-bold brutal-shadow-sm"
                >
                  Save Wordpack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
