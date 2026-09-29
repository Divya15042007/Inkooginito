import { useState, useEffect, useRef, useCallback } from 'react';
import { Stroke, StickyNote, RoomUser, ChatMessage, GameState } from '../types/drawing';

const USER_COLORS = [
  '#FF3366', // Hot Neon Pink
  '#3366FF', // Electric Cobalt
  '#00D26A', // Vivid Emerald
  '#FF9900', // Tangerine
  '#9933FF', // Ultraviolet
  '#00E5FF', // Bright Cyan
  '#FFD600', // Cyber Yellow
  '#FF3333'  // Crimson
];

const ANIMAL_AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐙', '🐨', '🐸', '🦉', '🦄', '🦖'];

export function useCollaboration(initialRoomId: string, initialMode: 'whiteboard' | 'game' = 'whiteboard') {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [roomName, setRoomName] = useState(`Room ${initialRoomId}`);
  const [roomMode, setRoomMode] = useState<'whiteboard' | 'game'>(initialMode);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  
  // Local User Identity
  const [currentUser, setCurrentUser] = useState<RoomUser>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isTestPlayer = urlParams.get('asTestPlayer') === '1';

    if (isTestPlayer) {
      const testId = sessionStorage.getItem('whodrew_test_uid') || `u_guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      sessionStorage.setItem('whodrew_test_uid', testId);
      return {
        id: testId,
        name: `Guest Artist ${Math.floor(10 + Math.random() * 90)}`,
        avatar: ANIMAL_AVATARS[Math.floor(Math.random() * ANIMAL_AVATARS.length)],
        color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
        isHost: false,
        score: 0
      };
    }

    const savedName = localStorage.getItem('whodrew_name') || `Artist_${Math.floor(100 + Math.random() * 900)}`;
    const savedAvatar = localStorage.getItem('whodrew_avatar') || ANIMAL_AVATARS[Math.floor(Math.random() * ANIMAL_AVATARS.length)];
    const savedColor = localStorage.getItem('whodrew_color') || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    const savedId = localStorage.getItem('whodrew_uid') || `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    
    localStorage.setItem('whodrew_uid', savedId);
    return {
      id: savedId,
      name: savedName,
      avatar: savedAvatar,
      color: savedColor,
      isHost: false,
      score: 0
    };
  });

  // Collaborative Room State
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    phase: 'lobby',
    category: 'Animals',
    secretWord: 'Elephant',
    questionMasterId: '',
    fakeArtistId: '',
    fakeArtistIds: [],
    playerOrder: [],
    currentTurnIndex: 0,
    currentRound: 1,
    maxRounds: 2,
    turnTimeLimit: 30,
    timeRemaining: 30,
    votes: {},
    winner: null
  });

  // Remote cursor positions
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number; isDrawing: boolean; tool: string }>>({});

  // Floating reaction bursts
  const [reactionBursts, setReactionBursts] = useState<{ id: string; emoji: string; x: number; y: number; author: string }[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCursorSendRef = useRef<number>(0);

  // Update user profile in local storage & sync
  const updateUserProfile = useCallback((name: string, avatar: string, color: string) => {
    localStorage.setItem('whodrew_name', name);
    localStorage.setItem('whodrew_avatar', avatar);
    localStorage.setItem('whodrew_color', color);
    
    setCurrentUser(prev => {
      const updated = { ...prev, name, avatar, color };
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'join_room',
          roomId,
          payload: { user: updated, mode: roomMode }
        }));
      }
      return updated;
    });
  }, [roomId, roomMode]);

  // Connect to WebSocket
  useEffect(() => {
    let isCancelled = false;

    function connect() {
      if (isCancelled) return;
      setConnectionStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isCancelled) return;
          setConnectionStatus('connected');
          // Join the room
          ws.send(JSON.stringify({
            type: 'join_room',
            roomId,
            payload: {
              user: currentUser,
              mode: roomMode,
              roomName: `Inkooginito Studio #${roomId}`
            }
          }));
        };

        ws.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(event.data);
            const { type, payload } = data;

            switch (type) {
              case 'room_state': {
                setRoomName(payload.roomName);
                setRoomMode(payload.mode);
                setUsers(payload.users || []);
                setStrokes(payload.strokes || []);
                setStickyNotes(payload.stickyNotes || []);
                setChatMessages(payload.chat || []);
                if (payload.gameState) setGameState(payload.gameState);
                
                // Update current user isHost if assigned by server
                const me = payload.users?.find((u: RoomUser) => u.id === currentUser.id);
                if (me) {
                  setCurrentUser(prev => ({ ...prev, isHost: me.isHost, score: me.score }));
                }
                break;
              }

              case 'user_joined': {
                setUsers(payload.users);
                break;
              }

              case 'user_left': {
                setUsers(payload.users);
                setRemoteCursors(prev => {
                  const updated = { ...prev };
                  delete updated[payload.userId];
                  return updated;
                });
                break;
              }

              case 'user_connection_changed': {
                setUsers(payload.users);
                break;
              }

              case 'stroke_added': {
                const newStroke: Stroke = payload.stroke;
                setStrokes(prev => {
                  if (prev.some(s => s.id === newStroke.id)) return prev;
                  return [...prev, newStroke];
                });
                break;
              }

              case 'canvas_updated': {
                setStrokes(payload.strokes || []);
                break;
              }

              case 'canvas_cleared': {
                setStrokes([]);
                break;
              }

              case 'sticky_added': {
                setStickyNotes(prev => [...prev, payload.note]);
                break;
              }

              case 'sticky_deleted': {
                setStickyNotes(prev => prev.filter(n => n.id !== payload.noteId));
                break;
              }

              case 'cursor_updated': {
                setRemoteCursors(prev => ({
                  ...prev,
                  [payload.userId]: payload.cursor
                }));
                break;
              }

              case 'reaction_received': {
                const burst = {
                  id: `react_${Date.now()}_${Math.random()}`,
                  emoji: payload.emoji,
                  x: payload.x,
                  y: payload.y,
                  author: payload.userId
                };
                setReactionBursts(prev => [...prev, burst]);
                setTimeout(() => {
                  setReactionBursts(prev => prev.filter(r => r.id !== burst.id));
                }, 2200);
                break;
              }

              case 'chat_received': {
                setChatMessages(prev => [...prev, payload.message]);
                break;
              }

              // GAME EVENTS
              case 'game_started': {
                setGameState(payload.gameState);
                setUsers(payload.users);
                setStrokes([]); // fresh canvas for game!
                break;
              }

              case 'game_turn_change': {
                setGameState(prev => ({
                  ...prev,
                  currentTurnIndex: payload.currentTurnIndex,
                  currentRound: payload.currentRound,
                  timeRemaining: prev.turnTimeLimit
                }));
                break;
              }

              case 'game_phase_change': {
                setGameState(payload.gameState);
                break;
              }

              case 'game_vote_update': {
                // update vote counts if needed
                break;
              }

              case 'game_caught_forger': {
                setGameState(prev => ({
                  ...prev,
                  phase: 'forger_guess',
                  fakeArtistId: payload.fakeArtistId,
                  votes: payload.votes
                }));
                break;
              }

              case 'game_over_result': {
                setGameState(payload.gameState);
                setUsers(payload.users);
                break;
              }

              case 'game_reset_lobby': {
                setGameState(payload.gameState);
                setStrokes([]);
                break;
              }
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message', err);
          }
        };

        ws.onclose = () => {
          if (isCancelled) return;
          setConnectionStatus('offline');
          // Reconnect with backoff
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          if (isCancelled) return;
          setConnectionStatus('offline');
          ws.close();
        };
      } catch (err) {
        setConnectionStatus('offline');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId]);

  // Actions
  const addStroke = useCallback((stroke: Stroke) => {
    // Optimistic addition
    setStrokes(prev => [...prev, stroke]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stroke_add',
        roomId,
        payload: { stroke }
      }));
    }
  }, [roomId]);

  const undoStroke = useCallback(() => {
    // Find last stroke drawn by current user
    setStrokes(prev => {
      const idx = prev.map(s => s.authorId).lastIndexOf(currentUser.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stroke_undo',
        roomId,
        payload: { userId: currentUser.id }
      }));
    }
  }, [roomId, currentUser.id]);

  const redoStroke = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stroke_redo',
        roomId,
        payload: { userId: currentUser.id }
      }));
    }
  }, [roomId, currentUser.id]);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'canvas_clear',
        roomId,
        payload: { authorName: currentUser.name }
      }));
    }
  }, [roomId, currentUser.name]);

  const addStickyNote = useCallback((note: StickyNote) => {
    setStickyNotes(prev => [...prev, note]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'sticky_add',
        roomId,
        payload: { note }
      }));
    }
  }, [roomId]);

  const deleteStickyNote = useCallback((noteId: string) => {
    setStickyNotes(prev => prev.filter(n => n.id !== noteId));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'sticky_delete',
        roomId,
        payload: { noteId }
      }));
    }
  }, [roomId]);

  const updateCursor = useCallback((x: number, y: number, isDrawing: boolean, tool: string) => {
    const now = performance.now();
    if (now - lastCursorSendRef.current < 35) return; // 30fps throttle
    lastCursorSendRef.current = now;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor_move',
        roomId,
        payload: { cursor: { x, y, isDrawing, tool } }
      }));
    }
  }, [roomId]);

  const sendReaction = useCallback((emoji: string, x: number, y: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction_burst',
        roomId,
        payload: { emoji, x, y }
      }));
    }
  }, [roomId]);

  const sendChatMessage = useCallback((text: string, type: 'chat' | 'guess' = 'chat') => {
    if (!text.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        roomId,
        payload: {
          text: text.trim(),
          senderName: currentUser.name,
          senderColor: currentUser.color,
          type
        }
      }));
    }
  }, [roomId, currentUser]);

  // Game specific dispatchers
  const startGame = useCallback((category?: string, word?: string, rounds = 2, turnTime = 30) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_start',
        roomId,
        payload: { category, word, rounds, turnTime }
      }));
    }
  }, [roomId]);

  const endTurn = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_end_turn',
        roomId,
        payload: {}
      }));
    }
  }, [roomId]);

  const startVoting = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_start_voting',
        roomId,
        payload: {}
      }));
    }
  }, [roomId]);

  const submitVote = useCallback((targetUserId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_vote',
        roomId,
        payload: { targetUserId }
      }));
    }
  }, [roomId]);

  const submitForgerGuess = useCallback((guess: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_forger_guess',
        roomId,
        payload: { guess }
      }));
    }
  }, [roomId]);

  const resetGameLobby = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_reset',
        roomId,
        payload: {}
      }));
    }
  }, [roomId]);

  const addPracticeBot = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'add_bot',
        roomId,
        payload: {}
      }));
    }
  }, [roomId]);

  const removePracticeBot = useCallback((botId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'remove_bot',
        roomId,
        payload: { botId }
      }));
    }
  }, [roomId]);

  return {
    roomId,
    setRoomId,
    roomName,
    roomMode,
    setRoomMode,
    connectionStatus,
    currentUser,
    updateUserProfile,
    users,
    strokes,
    setStrokes,
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
  };
}
