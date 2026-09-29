import React, { useState, useEffect, useCallback } from 'react';
import { useCollaboration } from './hooks/useCollaboration';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { Navbar } from './components/Navbar';
import { ExportModal } from './components/ExportModal';
import { TimelapseReplay } from './components/TimelapseReplay';
import { AuthorInspectorModal } from './components/AuthorInspectorModal';
import { ChatDrawer } from './components/ChatDrawer';
import { WhoDrewGame } from './components/WhoDrewGame';
import { JoinRoomModal } from './components/JoinRoomModal';
import { ShareRoomModal } from './components/ShareRoomModal';
import { ToolType, CanvasSettings, StickyNote } from './types/drawing';
import { playSound } from './utils/audio';

function getInitialRoomId(): string {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && roomParam.trim()) {
    return roomParam.trim();
  }
  // Generate memorable 6-character room code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getInitialMode(): 'whiteboard' | 'game' {
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode');
  if (modeParam === 'game') return 'game';
  return 'whiteboard';
}

export default function App() {
  const initialRoomId = getInitialRoomId();
  const initialMode = getInitialMode();

  const {
    roomId,
    setRoomId,
    roomMode,
    setRoomMode,
    connectionStatus,
    currentUser,
    updateUserProfile,
    users,
    strokes,
    stickyNotes,
    chatMessages,
    gameState,
    remoteCursors,
    reactionBursts,
    addStroke,
    undoStroke,
    redoStroke,
    clearCanvas,
    addStickyNote,
    deleteStickyNote,
    updateCursor,
    sendReaction,
    sendChatMessage,
    startGame,
    endTurn,
    startVoting,
    submitVote,
    submitForgerGuess,
    resetGameLobby,
    addPracticeBot,
    removePracticeBot
  } = useCollaboration(initialRoomId, initialMode);

  // Drawing Tools State
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#000000');
  const [currentSize, setCurrentSize] = useState<number>(4);

  // Canvas Settings
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>({
    background: 'dots',
    smoothing: 'medium',
    authorOverlayMode: false,
    soundEnabled: true
  });

  // Viewport navigation
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Author filter / inspector highlight
  const [highlightedAuthorId, setHighlightedAuthorId] = useState<string | null>(null);

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Sync URL search params
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    url.searchParams.set('mode', roomMode);
    window.history.replaceState({}, '', url.toString());
  }, [roomId, roomMode]);

  // Track unread messages if chat drawer is closed
  useEffect(() => {
    if (!isChatOpen && chatMessages.length > 0) {
      setUnreadChatCount(prev => prev + 1);
    }
  }, [chatMessages]);

  const handleOpenChat = () => {
    setIsChatOpen(prev => !prev);
    setUnreadChatCount(0);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input or textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoStroke();
        playSound('click', canvasSettings.soundEnabled);
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redoStroke();
        playSound('click', canvasSettings.soundEnabled);
        return;
      }

      // Tool hotkeys
      switch (e.key.toLowerCase()) {
        case 'p':
          setActiveTool('pen');
          playSound('click', canvasSettings.soundEnabled);
          break;
        case 'c':
          setActiveTool('calligraphy');
          playSound('click', canvasSettings.soundEnabled);
          break;
        case 'h':
          setActiveTool('highlighter');
          playSound('click', canvasSettings.soundEnabled);
          break;
        case 'b':
          setActiveTool('brush');
          playSound('click', canvasSettings.soundEnabled);
          break;
        case 'e':
          setActiveTool('eraser');
          playSound('click', canvasSettings.soundEnabled);
          break;
        case 'l':
          setActiveTool('laser');
          playSound('click', canvasSettings.soundEnabled);
          break;
        case 'i':
          setActiveTool('inspect');
          playSound('click', canvasSettings.soundEnabled);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStroke, redoStroke, canvasSettings.soundEnabled]);

  // Handle Sticky Note Creation at viewport center
  const handleAddStickyNote = useCallback(() => {
    const centerWorldX = (window.innerWidth / 2 - panOffset.x) / zoom - 100;
    const centerWorldY = (window.innerHeight / 2 - panOffset.y) / zoom - 60;

    const colors = ['#FEF08A', '#BAE6FD', '#BBF7D0', '#FBCFE8', '#FED7AA'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newNote: StickyNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: centerWorldX,
      y: centerWorldY,
      text: 'Double click to write your thought...',
      color: randomColor,
      authorName: currentUser.name,
      authorColor: currentUser.color
    };

    addStickyNote(newNote);
  }, [panOffset, zoom, currentUser, addStickyNote]);

  // Zoom helpers
  const handleZoomIn = () => setZoom(prev => Math.min(4.0, prev * 1.25));
  const handleZoomOut = () => setZoom(prev => Math.max(0.25, prev * 0.8));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // In Game Mode, determine if drawing is blocked
  const isMyTurnInGame = roomMode === 'game' && 
    gameState.phase === 'drawing' && 
    gameState.playerOrder[gameState.currentTurnIndex] === currentUser.id;

  const isDrawingBlocked = roomMode === 'game' && gameState.phase === 'drawing' && !isMyTurnInGame;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#FFFDF5] font-sans">
      {/* Top Navbar */}
      <Navbar
        roomId={roomId}
        roomMode={roomMode}
        setRoomMode={setRoomMode}
        connectionStatus={connectionStatus}
        currentUser={currentUser}
        onUpdateUserProfile={updateUserProfile}
        users={users}
        onUndo={undoStroke}
        onRedo={redoStroke}
        onClear={clearCanvas}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenReplay={() => setIsReplayOpen(true)}
        onOpenStats={() => setIsStatsOpen(true)}
        onOpenJoinRoom={() => setIsJoinOpen(true)}
        onOpenShareRoom={() => setIsShareOpen(true)}
        onToggleChat={handleOpenChat}
        unreadChatCount={unreadChatCount}
        soundEnabled={canvasSettings.soundEnabled}
        strokeCount={strokes.length}
      />

      {/* Main Interactive Canvas */}
      <main className="w-full h-full">
        <Canvas
          strokes={strokes}
          onAddStroke={addStroke}
          stickyNotes={stickyNotes}
          onAddStickyNote={addStickyNote}
          onDeleteStickyNote={deleteStickyNote}
          currentUser={currentUser}
          activeTool={activeTool}
          currentColor={currentColor}
          currentSize={currentSize}
          canvasSettings={canvasSettings}
          remoteCursors={remoteCursors}
          users={users}
          onUpdateCursor={updateCursor}
          onSendReaction={sendReaction}
          isMyTurnInGame={isMyTurnInGame}
          gamePhase={gameState.phase}
          zoom={zoom}
          panOffset={panOffset}
          setPanOffset={setPanOffset}
          highlightedAuthorId={highlightedAuthorId}
          onSelectAuthorForFilter={setHighlightedAuthorId}
          isDrawingBlocked={isDrawingBlocked}
        />
      </main>

      {/* Floating Reactions on Canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {reactionBursts.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.x}px`, top: `${r.y}px` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl animate-bounce drop-shadow-[3px_3px_0px_#000]"
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Primary Neobrutalist Drawing Toolbar */}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        currentColor={currentColor}
        setCurrentColor={setCurrentColor}
        currentSize={currentSize}
        setCurrentSize={setCurrentSize}
        canvasSettings={canvasSettings}
        setCanvasSettings={setCanvasSettings}
        onAddStickyNote={handleAddStickyNote}
        isDrawingBlocked={isDrawingBlocked}
      />

      {/* Game Mode Overlay (Lobby, Turn Banner, Voting, Forger Guess, Podium) */}
      {roomMode === 'game' && (
        <WhoDrewGame
          gameState={gameState}
          currentUser={currentUser}
          users={users}
          onStartGame={startGame}
          onEndTurn={endTurn}
          onStartVoting={startVoting}
          onSubmitVote={submitVote}
          onSubmitForgerGuess={submitForgerGuess}
          onResetGame={resetGameLobby}
          onOpenShareRoom={() => setIsShareOpen(true)}
          onAddBot={addPracticeBot}
          onRemoveBot={removePracticeBot}
          soundEnabled={canvasSettings.soundEnabled}
        />
      )}

      {/* Pro Export Suite Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        strokes={strokes}
        canvasBackground={canvasSettings.background}
        soundEnabled={canvasSettings.soundEnabled}
      />

      {/* Timelapse Replay Modal */}
      <TimelapseReplay
        isOpen={isReplayOpen}
        onClose={() => setIsReplayOpen(false)}
        strokes={strokes}
        soundEnabled={canvasSettings.soundEnabled}
      />

      {/* Author Attribution Stats Modal */}
      <AuthorInspectorModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        strokes={strokes}
        users={users}
        highlightedAuthorId={highlightedAuthorId}
        onSelectAuthorForFilter={setHighlightedAuthorId}
      />

      {/* Chat & Reaction Stamps Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        currentUser={currentUser}
        onSendMessage={sendChatMessage}
        onSendReaction={sendReaction}
        soundEnabled={canvasSettings.soundEnabled}
      />

      {/* Join / Switch Room Modal */}
      <JoinRoomModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        currentRoomId={roomId}
        onJoinRoom={(newRoomId) => setRoomId(newRoomId)}
        soundEnabled={canvasSettings.soundEnabled}
      />

      {/* Share / Invite Friends Modal */}
      <ShareRoomModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        roomId={roomId}
        roomMode={roomMode}
        soundEnabled={canvasSettings.soundEnabled}
      />
    </div>
  );
}
