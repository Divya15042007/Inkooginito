export interface Point {
  x: number;
  y: number;
  pressure: number;
  time?: number;
}

export type ToolType = 
  | 'pen' 
  | 'calligraphy' 
  | 'highlighter' 
  | 'brush' 
  | 'eraser' 
  | 'laser' 
  | 'rect' 
  | 'circle' 
  | 'arrow' 
  | 'line' 
  | 'sticky' 
  | 'inspect';

export type EraserMode = 'stroke' | 'pixel';

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

export type CanvasBackground = 'dots' | 'lines' | 'graph' | 'clean';

export interface CanvasSettings {
  background: CanvasBackground;
  smoothing: 'low' | 'medium' | 'high';
  authorOverlayMode: boolean; // Colorize all strokes by artist color
  soundEnabled: boolean;
}
