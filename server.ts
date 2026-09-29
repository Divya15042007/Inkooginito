import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { serverConfig } from './server.config.ts';
import {
  buildWordDatabase,
  chooseFakeArtistCount,
  pickRandomWord,
  resolveTieVotes,
  type Difficulty,
  validateGeneratedWords
} from './src/utils/wordEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);

app.use(express.json({ limit: serverConfig.jsonLimit }));

function getRequestOrigin(req: express.Request): string {
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host') || req.get('host');
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  const host = forwardedHost ? forwardedHost.split(',')[0].trim() : req.get('host');
  const value = `${protocol}://${host}`;
  return value.replace(/\/$/, '');
}

export interface Point {
  x: number;
  y: number;
  pressure: number;
  time?: number;
}

export interface Stroke {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  tool: 'pen' | 'calligraphy' | 'highlighter' | 'brush' | 'eraser' | 'rect' | 'circle' | 'arrow' | 'line';
  color: string;
  size: number;
  points: Point[];
  timestamp: number;
  roundIndex?: number;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  authorName: string;
  authorColor: string;
}

export interface RoomUser {
  id: string;
  name: string;
  color: string;
  avatar: string;
  cursor?: { x: number; y: number; isDrawing: boolean; tool: string };
  isHost: boolean;
  score: number;
  role?: 'artist' | 'fake_artist' | 'question_master';
  hasDrawnCurrentTurn?: boolean;
  connected?: boolean;
  isBot?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
  type?: 'chat' | 'system' | 'guess';
}

export interface GameState {
  phase: 'lobby' | 'word_selection' | 'drawing' | 'discussion' | 'voting' | 'forger_guess' | 'game_over';
  category: string;
  secretWord: string;
  questionMasterId: string;
  fakeArtistId: string;
  fakeArtistIds: string[];
  playerOrder: string[];
  currentTurnIndex: number;
  currentRound: number;
  maxRounds: number;
  turnTimeLimit: number;
  timeRemaining: number;
  votes: Record<string, string>;
  winner: 'artists' | 'fake_artist' | null;
  winReason?: string;
  forgerGuess?: string;
}

export interface Room {
  id: string;
  name: string;
  mode: 'whiteboard' | 'game';
  isPublic: boolean;
  strokes: Stroke[];
  undoneStrokes: Stroke[];
  stickyNotes: StickyNote[];
  users: Map<string, RoomUser>;
  clients: Map<string, WebSocket>;
  chat: ChatMessage[];
  gameState: GameState;
  createdAt: number;
  lastActiveAt: number;
  disconnectTimeouts: Map<string, NodeJS.Timeout>;
}

// In-memory rooms repository
const rooms = new Map<string, Room>();
const WORDS_DATABASE = buildWordDatabase();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function normalizeCategoryName(category?: string): string {
  const raw = String(category || 'Animals').trim();
  if (!raw) return 'Animals';
  return Object.prototype.hasOwnProperty.call(WORDS_DATABASE, raw) ? raw : 'Animals';
}

function sanitizeWordInput(word: string): string {
  return String(word || '').trim().replace(/\s+/g, ' ');
}

async function generateAiWords(category: string, difficulty: Difficulty, count = 10): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Return ONLY a valid JSON array of ${count} unique, family-friendly words for the category "${category}" and difficulty "${difficulty}". No explanations, no markdown, no duplicates. Use simple nouns or phrases.`,
    });

    const text = String((response as { text?: string } | undefined)?.text ?? '').trim();
    const parsed = text.match(/\[[\s\S]*\]/)?.[0];
    if (!parsed) return [];
    const candidateWords = JSON.parse(parsed);
    return validateGeneratedWords(candidateWords, category, difficulty);
  } catch (error) {
    console.warn('AI word generation fallback used:', error);
    return [];
  }
}

function getOrCreateRoom(roomId: string, mode: 'whiteboard' | 'game' = 'whiteboard', roomName?: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      name: roomName || (mode === 'game' ? `Inkooginito Match #${roomId}` : `Inkooginito Studio #${roomId}`),
      mode,
      isPublic: true,
      strokes: [],
      undoneStrokes: [],
      stickyNotes: [],
      users: new Map(),
      clients: new Map(),
      chat: [
        {
          id: 'welcome',
          senderId: 'system',
          senderName: 'Inkooginito Host',
          senderColor: '#FFE600',
          text: mode === 'game' 
            ? 'Welcome to Inkooginito! Invite friends to join your match.' 
            : 'Welcome to the Collaborative Whiteboard! Share room code or link to draw together.',
          timestamp: Date.now(),
          type: 'system'
        }
      ],
      gameState: {
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
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      disconnectTimeouts: new Map()
    };
    rooms.set(roomId, room);
  }
  room.lastActiveAt = Date.now();
  return room;
}

// Broadcast helper
function broadcastToRoom(room: Room, message: object, excludeUserId?: string) {
  room.lastActiveAt = Date.now();
  const payload = JSON.stringify(message);
  for (const [userId, client] of room.clients.entries()) {
    if (userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// REST Endpoints
app.get('/api/config', (req, res) => {
  res.json({
    appUrl: serverConfig.appUrl || getRequestOrigin(req),
    version: serverConfig.appVersion,
    serverTime: Date.now(),
    mode: serverConfig.environment,
    roomCount: rooms.size
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    uptime: process.uptime(),
    rooms: rooms.size,
    time: Date.now()
  });
});

app.get('/ready', (req, res) => {
  const roomCount = rooms.size;
  res.status(200).json({
    ready: true,
    roomCount,
    websocket: true,
    timestamp: Date.now()
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  return res.json({
    id: room.id,
    name: room.name,
    mode: room.mode,
    isPublic: room.isPublic,
    playerCount: Array.from(room.users.values()).filter(u => u.connected !== false).length,
    phase: room.gameState.phase,
    createdAt: room.createdAt
  });
});

app.get('/api/words', (req, res) => {
  res.json({ categories: WORDS_DATABASE, totalCategories: Object.keys(WORDS_DATABASE).length });
});

app.get('/api/words/random', (req, res) => {
  const categoryKeys = Object.keys(WORDS_DATABASE);
  const inputCategory = String(req.query.category || '').trim();
  const difficulty = String(req.query.difficulty || 'medium').toLowerCase() as Difficulty;
  const cat = normalizeCategoryName(inputCategory || categoryKeys[Math.floor(Math.random() * categoryKeys.length)]);
  const word = pickRandomWord(cat, difficulty);
  res.json({ category: cat, difficulty, word });
});

app.post('/api/words/custom', (req, res) => {
  const { category, words } = req.body;
  if (!category || !Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'Category and array of words required' });
  }
  const cleanCat = String(category).trim();
  const cleanWords = words.map((w: unknown) => sanitizeWordInput(String(w))).filter(Boolean);
  if (!WORDS_DATABASE[cleanCat]) {
    WORDS_DATABASE[cleanCat] = [];
  }
  for (const word of cleanWords) {
    if (!WORDS_DATABASE[cleanCat].includes(word)) {
      WORDS_DATABASE[cleanCat].push(word);
    }
  }
  res.json({ success: true, category: cleanCat, totalWords: WORDS_DATABASE[cleanCat].length });
});

app.post('/api/words/generate', async (req, res) => {
  const { category, difficulty = 'medium', count = 10 } = req.body || {};
  const cleanCategory = normalizeCategoryName(category);
  const safeDifficulty = String(difficulty).toLowerCase() as Difficulty;
  const requestedCount = Number.isFinite(Number(count)) ? Math.max(1, Math.min(Number(count), 12)) : 10;

  const databaseWords = WORDS_DATABASE[cleanCategory] || [];
  const fallback = validateGeneratedWords(databaseWords, cleanCategory, safeDifficulty).slice(0, requestedCount);

  const aiWords = await generateAiWords(cleanCategory, safeDifficulty, requestedCount);
  const combined = [...new Set([...(aiWords.length ? aiWords : []), ...fallback])];
  const selected = combined.slice(0, requestedCount);

  res.json({ category: cleanCategory, difficulty: safeDifficulty, words: selected, source: aiWords.length ? 'ai' : 'database' });
});

app.post('/api/rooms/create', (req, res) => {
  const { mode = 'game', roomName, isPublic = true, maxPlayers = 8, rounds = 2, turnTime = 30, category, difficulty = 'medium', botsEnabled = true } = req.body || {};
  const normalizedMode = mode === 'whiteboard' ? 'whiteboard' : 'game';
  const roomId = generateRoomCode();
  const room = getOrCreateRoom(roomId, normalizedMode, roomName || `${normalizedMode === 'game' ? 'Inkooginito Match' : 'Inkooginito Studio'} #${roomId}`);
  room.isPublic = isPublic;
  room.gameState.category = normalizeCategoryName(category);
  room.gameState.maxRounds = Number.isFinite(Number(rounds)) ? Number(rounds) : 2;
  room.gameState.turnTimeLimit = Number.isFinite(Number(turnTime)) ? Number(turnTime) : 30;
  room.gameState.timeRemaining = room.gameState.turnTimeLimit;
  room.gameState.secretWord = pickRandomWord(room.gameState.category, String(difficulty).toLowerCase() as Difficulty);
  const inviteLink = `${serverConfig.appUrl || getRequestOrigin(req)}?room=${encodeURIComponent(roomId)}&mode=${encodeURIComponent(normalizedMode)}`;

  res.json({
    roomId,
    roomCode: roomId,
    inviteLink,
    roomName: room.name,
    mode: normalizedMode,
    settings: {
      maxPlayers,
      rounds: room.gameState.maxRounds,
      turnTime: room.gameState.turnTimeLimit,
      category: room.gameState.category,
      difficulty,
      botsEnabled
    }
  });
});

app.get('/api/rooms', (req, res) => {
  const activeRooms = Array.from(rooms.values())
    .filter(r => r.isPublic)
    .map(r => ({
      id: r.id,
      name: r.name,
      mode: r.mode,
      playerCount: Array.from(r.users.values()).filter(u => u.connected !== false).length,
      strokeCount: r.strokes.length,
      createdAt: r.createdAt,
      phase: r.gameState.phase
    }));
  res.json({ rooms: activeRooms });
});

// Periodic room cleanup for abandoned rooms (> 4 hours old with 0 active users)
const roomCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, r] of rooms.entries()) {
    const activeClients = Array.from(r.clients.values()).filter(c => c.readyState === WebSocket.OPEN);
    if (activeClients.length === 0 && now - r.lastActiveAt > serverConfig.roomTtlMs) {
      rooms.delete(id);
    }
  }
}, serverConfig.cleanupIntervalMs);
roomCleanupInterval.unref();

// WebSocket Server with Heartbeat
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: serverConfig.maxPayloadBytes });

// Keep-alive heartbeat every 25 seconds for Cloud Run & proxy connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((wsClient) => {
    const client = wsClient as WebSocket & { isAlive?: boolean };
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, serverConfig.heartbeatIntervalMs);
heartbeatInterval.unref();

wss.on('close', () => clearInterval(heartbeatInterval));

wss.on('connection', (wsClient: WebSocket) => {
  const ws = wsClient as WebSocket & { isAlive?: boolean };
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  // Bot Turn Automation Helper
  const handleBotTurnIfActive = (room: Room) => {
    if (room.gameState.phase !== 'drawing') return;
    const currentUserId = room.gameState.playerOrder[room.gameState.currentTurnIndex];
    const currentUser = room.users.get(currentUserId);

    if (currentUser?.isBot) {
      setTimeout(() => {
        if (room.gameState.phase !== 'drawing') return;
        // Generate a fun curved stroke
        const cx = 400 + Math.random() * 200;
        const cy = 300 + Math.random() * 150;
        const botPoints: Point[] = [];
        const radius = 30 + Math.random() * 50;

        for (let a = 0; a <= Math.PI * 1.5; a += 0.2) {
          botPoints.push({
            x: cx + Math.cos(a) * radius,
            y: cy + Math.sin(a) * radius,
            pressure: 0.5 + Math.sin(a) * 0.3,
            time: Date.now()
          });
        }

        const botStroke: Stroke = {
          id: `bot_str_${Date.now()}`,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorColor: currentUser.color,
          tool: 'pen',
          color: currentUser.color,
          size: 5,
          points: botPoints,
          timestamp: Date.now()
        };

        room.strokes.push(botStroke);
        broadcastToRoom(room, {
          type: 'stroke_added',
          payload: { stroke: botStroke }
        });

        // Advance turn after small delay
        setTimeout(() => {
          advanceGameTurn(room);
        }, 1200);
      }, 1500);
    }
  };

  // Turn advancement helper
  const advanceGameTurn = (room: Room) => {
    if (room.gameState.phase !== 'drawing') return;
    let nextIndex = room.gameState.currentTurnIndex + 1;
    let nextRound = room.gameState.currentRound;

    if (nextIndex >= room.gameState.playerOrder.length) {
      nextIndex = 0;
      nextRound += 1;
    }

    if (nextRound > room.gameState.maxRounds) {
      room.gameState.phase = 'discussion';
      room.gameState.timeRemaining = 60;

      broadcastToRoom(room, {
        type: 'game_phase_change',
        payload: {
          gameState: {
            ...room.gameState,
            fakeArtistId: ''
          }
        }
      });

      const sysMsg: ChatMessage = {
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: 'Inkooginito Host',
        senderColor: '#FF5470',
        text: 'All rounds completed! Inspect each stroke and debate before voting.',
        timestamp: Date.now(),
        type: 'system'
      };
      room.chat.push(sysMsg);
      broadcastToRoom(room, { type: 'chat_received', payload: { message: sysMsg } });
    } else {
      room.gameState.currentTurnIndex = nextIndex;
      room.gameState.currentRound = nextRound;
      room.gameState.timeRemaining = room.gameState.turnTimeLimit;

      const nextUserId = room.gameState.playerOrder[nextIndex];
      const nextUser = room.users.get(nextUserId);

      broadcastToRoom(room, {
        type: 'game_turn_change',
        payload: {
          currentTurnIndex: nextIndex,
          currentRound: nextRound,
          currentTurnUserId: nextUserId,
          currentTurnUserName: nextUser?.name
        }
      });

      handleBotTurnIfActive(room);
    }
  };

  ws.on('message', (data: string) => {
    try {
      ws.isAlive = true;
      const msg = JSON.parse(data.toString());
      const { type, roomId, payload } = msg;

      if (type === 'join_room') {
        const { user, mode, roomName } = payload;
        currentRoomId = roomId;
        currentUserId = user.id;

        const room = getOrCreateRoom(roomId, mode || 'whiteboard', roomName);

        // Cancel pending disconnect timeout if reconnecting
        if (room.disconnectTimeouts.has(user.id)) {
          clearTimeout(room.disconnectTimeouts.get(user.id)!);
          room.disconnectTimeouts.delete(user.id);
        }

        const existingUser = room.users.get(user.id);
        const isFirstUser = room.users.size === 0;

        const joinedUser: RoomUser = {
          ...user,
          score: existingUser ? existingUser.score : (user.score || 0),
          role: existingUser ? existingUser.role : user.role,
          isHost: existingUser ? existingUser.isHost : (isFirstUser || user.isHost),
          connected: true
        };

        room.users.set(user.id, joinedUser);
        room.clients.set(user.id, ws);

        // Send full room state to joined user
        ws.send(JSON.stringify({
          type: 'room_state',
          payload: {
            roomId: room.id,
            roomName: room.name,
            mode: room.mode,
            users: Array.from(room.users.values()),
            strokes: room.strokes,
            stickyNotes: room.stickyNotes,
            chat: room.chat,
            gameState: room.gameState
          }
        }));

        // Broadcast user joined
        broadcastToRoom(room, {
          type: 'user_joined',
          payload: {
            user: joinedUser,
            users: Array.from(room.users.values())
          }
        }, user.id);

        return;
      }

      if (!currentRoomId || !rooms.has(currentRoomId)) return;
      const room = rooms.get(currentRoomId)!;

      switch (type) {
        case 'stroke_add': {
          const stroke: Stroke = payload.stroke;
          if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0 || stroke.points.length > serverConfig.maxStrokePoints) break;
          if (room.strokes.length >= serverConfig.maxRoomStrokes) room.strokes.shift();
          if (!room.strokes.some(s => s.id === stroke.id)) {
            room.strokes.push(stroke);
            room.undoneStrokes = [];
            broadcastToRoom(room, {
              type: 'stroke_added',
              payload: { stroke }
            }, currentUserId || undefined);
          }
          break;
        }

        case 'stroke_undo': {
          const { userId } = payload;
          const targetIndex = room.strokes.map(s => s.authorId).lastIndexOf(userId);
          if (targetIndex !== -1) {
            const [removed] = room.strokes.splice(targetIndex, 1);
            room.undoneStrokes.push(removed);
            broadcastToRoom(room, {
              type: 'canvas_updated',
              payload: { strokes: room.strokes }
            });
          }
          break;
        }

        case 'stroke_redo': {
          const { userId } = payload;
          const targetIndex = room.undoneStrokes.map(s => s.authorId).lastIndexOf(userId);
          if (targetIndex !== -1) {
            const [restored] = room.undoneStrokes.splice(targetIndex, 1);
            room.strokes.push(restored);
            broadcastToRoom(room, {
              type: 'canvas_updated',
              payload: { strokes: room.strokes }
            });
          }
          break;
        }

        case 'canvas_clear': {
          room.strokes = [];
          room.undoneStrokes = [];
          broadcastToRoom(room, {
            type: 'canvas_cleared',
            payload: { authorName: payload.authorName }
          });
          break;
        }

        case 'sticky_add': {
          const note: StickyNote = payload.note;
          if (!note || room.stickyNotes.length >= serverConfig.maxStickyNotes) break;
          room.stickyNotes.push(note);
          broadcastToRoom(room, {
            type: 'sticky_added',
            payload: { note }
          });
          break;
        }

        case 'sticky_delete': {
          room.stickyNotes = room.stickyNotes.filter(n => n.id !== payload.noteId);
          broadcastToRoom(room, {
            type: 'sticky_deleted',
            payload: { noteId: payload.noteId }
          });
          break;
        }

        case 'cursor_move': {
          const user = room.users.get(currentUserId!);
          if (user) {
            user.cursor = payload.cursor;
            broadcastToRoom(room, {
              type: 'cursor_updated',
              payload: {
                userId: currentUserId,
                cursor: payload.cursor
              }
            }, currentUserId!);
          }
          break;
        }

        case 'reaction_burst': {
          broadcastToRoom(room, {
            type: 'reaction_received',
            payload: {
              userId: currentUserId,
              emoji: payload.emoji,
              x: payload.x,
              y: payload.y
            }
          });
          break;
        }

        case 'chat_message': {
          const text = String(payload.text || '').trim().slice(0, 1000);
          if (!text) break;
          const chatMsg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            senderId: currentUserId!,
            senderName: payload.senderName || 'Anonymous',
            senderColor: payload.senderColor || '#000000',
            text,
            timestamp: Date.now(),
            type: payload.type || 'chat'
          };
          room.chat.push(chatMsg);
          if (room.chat.length > serverConfig.maxChatMessages) room.chat.shift();
          broadcastToRoom(room, {
            type: 'chat_received',
            payload: { message: chatMsg }
          });
          break;
        }

        // Add Practice Bot into room
        case 'add_bot': {
          const botId = `bot_${Date.now()}`;
          const botNames = ['DoodleBot 🤖', 'PicassoAI 🎨', 'SketchyBot 🖌️', 'ArtieBot 🦊'];
          const botColors = ['#FF3366', '#00D26A', '#3366FF', '#FF9900'];
          const chosenName = botNames[Math.floor(Math.random() * botNames.length)];
          const chosenColor = botColors[Math.floor(Math.random() * botColors.length)];

          const botUser: RoomUser = {
            id: botId,
            name: chosenName,
            avatar: '🤖',
            color: chosenColor,
            isHost: false,
            score: 0,
            connected: true,
            isBot: true
          };

          room.users.set(botId, botUser);
          broadcastToRoom(room, {
            type: 'user_joined',
            payload: {
              user: botUser,
              users: Array.from(room.users.values())
            }
          });
          break;
        }

        // Remove Practice Bot
        case 'remove_bot': {
          const { botId } = payload;
          if (room.users.has(botId)) {
            room.users.delete(botId);
            broadcastToRoom(room, {
              type: 'user_left',
              payload: {
                userId: botId,
                users: Array.from(room.users.values())
              }
            });
          }
          break;
        }

        // ==================== GAME MODE LOGIC ====================
        case 'game_start': {
          const activeUsers = Array.from(room.users.values()).filter(u => u.connected !== false);
          if (activeUsers.length < 2) {
            ws.send(JSON.stringify({
              type: 'error',
              payload: { message: 'Need at least 2 players in the room to start!' }
            }));
            return;
          }

          const shuffled = [...activeUsers].sort(() => Math.random() - 0.5);
          const questionMaster = shuffled[0];
          const configuredFakeCount = Number(payload.fakeArtistCount ?? 0);
          const fakeArtistPool = chooseFakeArtistCount(activeUsers.length);
          const selectedFakeCount = configuredFakeCount > 0 ? Math.min(configuredFakeCount, activeUsers.length - 1) : fakeArtistPool[0];
          const fakeArtists = shuffled.slice(1, 1 + selectedFakeCount).map(u => u.id);
          const fakeArtistId = fakeArtists[0] || shuffled[1]?.id || questionMaster.id;

          const categoryKeys = Object.keys(WORDS_DATABASE);
          const chosenCategory = payload.category && WORDS_DATABASE[payload.category]
            ? payload.category
            : categoryKeys[Math.floor(Math.random() * categoryKeys.length)];

          const chosenWord = payload.word && sanitizeWordInput(String(payload.word))
            ? sanitizeWordInput(String(payload.word))
            : pickRandomWord(chosenCategory, 'medium');

          const playerOrder = shuffled.map(u => u.id);

          room.gameState = {
            phase: 'drawing',
            category: chosenCategory,
            secretWord: chosenWord,
            questionMasterId: questionMaster.id,
            fakeArtistId,
            fakeArtistIds: fakeArtists,
            playerOrder,
            currentTurnIndex: 0,
            currentRound: 1,
            maxRounds: Number(payload.rounds) || 2,
            turnTimeLimit: Number(payload.turnTime) || 30,
            timeRemaining: Number(payload.turnTime) || 30,
            votes: {},
            winner: null
          };

          room.strokes = [];

          activeUsers.forEach(u => {
            if (fakeArtists.includes(u.id)) u.role = 'fake_artist';
            else if (u.id === questionMaster.id) u.role = 'question_master';
            else u.role = 'artist';
          });

          for (const [uid, client] of room.clients.entries()) {
            if (client.readyState === WebSocket.OPEN) {
              const isFake = fakeArtists.includes(uid);
              client.send(JSON.stringify({
                type: 'game_started',
                payload: {
                  gameState: {
                    ...room.gameState,
                    secretWord: isFake ? '???' : room.gameState.secretWord,
                    fakeArtistId: ''
                  },
                  users: Array.from(room.users.values()).map(u => ({
                    ...u,
                    role: u.id === uid ? u.role : undefined
                  }))
                }
              }));
            }
          }

          const sysMsg: ChatMessage = {
            id: `sys_${Date.now()}`,
            senderId: 'system',
            senderName: 'Inkooginito Host',
            senderColor: '#FFE600',
            text: `Match started! Category: ${chosenCategory}. ${fakeArtists.length > 1 ? `${fakeArtists.length} fake artists were assigned.` : 'One fake artist was assigned.'} First drawer: ${room.users.get(playerOrder[0])?.name}!`,
            timestamp: Date.now(),
            type: 'system'
          };
          room.chat.push(sysMsg);
          broadcastToRoom(room, { type: 'chat_received', payload: { message: sysMsg } });

          handleBotTurnIfActive(room);
          break;
        }

        case 'game_end_turn': {
          advanceGameTurn(room);
          break;
        }

        case 'game_start_voting': {
          room.gameState.phase = 'voting';
          room.gameState.votes = {};
          broadcastToRoom(room, {
            type: 'game_phase_change',
            payload: {
              gameState: {
                ...room.gameState,
                fakeArtistId: ''
              }
            }
          });
          break;
        }

        case 'game_vote': {
          const { targetUserId } = payload;
          room.gameState.votes[currentUserId!] = targetUserId;

          Array.from(room.users.values()).filter(u => u.isBot).forEach(bot => {
            if (!room.gameState.votes[bot.id]) {
              const possibleTargets = Array.from(room.users.values()).filter(u => u.id !== bot.id);
              const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
              if (target) room.gameState.votes[bot.id] = target.id;
            }
          });

          const activeUsers = Array.from(room.users.values()).filter(u => u.connected !== false);
          const activeUserCount = activeUsers.length;
          const voteCount = Object.keys(room.gameState.votes).length;

          broadcastToRoom(room, {
            type: 'game_vote_update',
            payload: {
              votesCount: voteCount,
              totalPlayers: activeUserCount
            }
          });

          if (voteCount >= activeUserCount) {
            const accusedPlayerId = resolveTieVotes(room.gameState.votes, activeUsers.map(u => u.id));
            const fakeArtistSet = new Set(room.gameState.fakeArtistIds?.length ? room.gameState.fakeArtistIds : [room.gameState.fakeArtistId].filter(Boolean));
            const fakeArtistUser = room.users.get(room.gameState.fakeArtistId);
            const wasFakeArtist = fakeArtistSet.has(accusedPlayerId);

            if (wasFakeArtist) {
              room.gameState.phase = 'forger_guess';
              broadcastToRoom(room, {
                type: 'game_caught_forger',
                payload: {
                  accusedId: accusedPlayerId,
                  fakeArtistId: room.gameState.fakeArtistId,
                  fakeArtistName: fakeArtistUser?.name,
                  votes: room.gameState.votes
                }
              });

              if (fakeArtistUser?.isBot) {
                setTimeout(() => {
                  const guess = Math.random() > 0.6 ? room.gameState.secretWord : 'Wrong Guess';
                  room.gameState.forgerGuess = guess;
                  room.gameState.phase = 'game_over';
                  const isCorrect = guess === room.gameState.secretWord;
                  if (isCorrect) {
                    room.gameState.winner = 'fake_artist';
                    room.gameState.winReason = `The Fake Artist (${fakeArtistUser.name}) guessed "${room.gameState.secretWord}"!`;
                    fakeArtistUser.score += 3;
                  } else {
                    room.gameState.winner = 'artists';
                    room.gameState.winReason = `The Fake Artist guessed "${guess}", but the secret word was "${room.gameState.secretWord}"! Genuine Artists win!`;
                    for (const u of room.users.values()) {
                      if (!fakeArtistSet.has(u.id)) u.score += 1;
                    }
                  }
                  broadcastToRoom(room, {
                    type: 'game_over_result',
                    payload: {
                      gameState: room.gameState,
                      users: Array.from(room.users.values())
                    }
                  });
                }, 2000);
              }
            } else {
              room.gameState.phase = 'game_over';
              room.gameState.winner = 'fake_artist';
              room.gameState.winReason = `The artists wrongly accused ${room.users.get(accusedPlayerId)?.name}! The fake artist team hid successfully.`;
              for (const id of room.gameState.fakeArtistIds) {
                const user = room.users.get(id);
                if (user) user.score += 2;
              }

              broadcastToRoom(room, {
                type: 'game_over_result',
                payload: {
                  gameState: room.gameState,
                  users: Array.from(room.users.values())
                }
              });
            }
          }
          break;
        }

        case 'game_forger_guess': {
          const { guess } = payload;
          const secret = room.gameState.secretWord.toLowerCase().trim();
          const playerGuess = (guess || '').toLowerCase().trim();

          room.gameState.forgerGuess = guess;
          room.gameState.phase = 'game_over';

          const isCorrect = playerGuess.length >= 2 && (secret.includes(playerGuess) || playerGuess.includes(secret));
          const fakeArtistSet = new Set(room.gameState.fakeArtistIds?.length ? room.gameState.fakeArtistIds : [room.gameState.fakeArtistId].filter(Boolean));
          const fakeArtistUser = room.users.get(room.gameState.fakeArtistId);

          if (isCorrect) {
            room.gameState.winner = 'fake_artist';
            room.gameState.winReason = `The Fake Artist team correctly guessed "${room.gameState.secretWord}" and stole victory!`;
            for (const id of room.gameState.fakeArtistIds) {
              const user = room.users.get(id);
              if (user) user.score += 3;
            }
          } else {
            room.gameState.winner = 'artists';
            room.gameState.winReason = `The Fake Artist guessed "${guess}", but the secret word was "${room.gameState.secretWord}"! Genuine Artists win!`;
            for (const u of room.users.values()) {
              if (!fakeArtistSet.has(u.id)) {
                u.score += 1;
              }
            }
          }

          broadcastToRoom(room, {
            type: 'game_over_result',
            payload: {
              gameState: room.gameState,
              users: Array.from(room.users.values())
            }
          });
          break;
        }

        case 'game_reset': {
          room.gameState.phase = 'lobby';
          room.gameState.votes = {};
          room.gameState.winner = null;
          room.strokes = [];
          broadcastToRoom(room, {
            type: 'game_reset_lobby',
            payload: {
              gameState: room.gameState,
              strokes: []
            }
          });
          break;
        }
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentUserId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId)!;
      room.clients.delete(currentUserId);
      
      const user = room.users.get(currentUserId);
      if (user) {
        user.connected = false;
        const closingUserId = currentUserId;

        // Broadcast user disconnected status
        broadcastToRoom(room, {
          type: 'user_connection_changed',
          payload: {
            userId: closingUserId,
            connected: false,
            users: Array.from(room.users.values())
          }
        });

        // 45-second grace period before permanently removing
        const timeout = setTimeout(() => {
          if (closingUserId && room.users.has(closingUserId) && !room.clients.has(closingUserId)) {
            room.users.delete(closingUserId);
            room.disconnectTimeouts.delete(closingUserId);

            // Reassign host if host permanently left
            const activeUsers = Array.from(room.users.values()).filter(u => u.connected !== false);
            if (activeUsers.length > 0 && !activeUsers.some(u => u.isHost)) {
              activeUsers[0].isHost = true;
            }

            // If it was this user's turn in game, skip to next turn
            if (room.gameState.phase === 'drawing' && room.gameState.playerOrder[room.gameState.currentTurnIndex] === closingUserId) {
              advanceGameTurn(room);
            }

            broadcastToRoom(room, {
              type: 'user_left',
              payload: {
                userId: closingUserId,
                users: Array.from(room.users.values())
              }
            });
          }
        }, serverConfig.disconnectGraceMs);

        room.disconnectTimeouts.set(closingUserId, timeout);
      }
    }
  });
});

// Setup Vite or static serving
const DEFAULT_PORT = serverConfig.port;

function listenWithFallback(port: number) {
  server.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = port + 1;
      console.warn(`Port ${port} is busy. Retrying on ${fallbackPort}.`);
      listenWithFallback(fallbackPort);
      return;
    }
    throw error;
  });

  server.listen(port, () => {
    const baseUrl = process.env.APP_URL || `http://localhost:${port}`;
    console.log(`Inkooginito server is ready at ${baseUrl}`);
    console.log(`Health: ${baseUrl}/health`);
  });
}

async function startServer() {
  const isDev = serverConfig.environment !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  listenWithFallback(DEFAULT_PORT);
}

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => process.exit(0));
});

startServer();
