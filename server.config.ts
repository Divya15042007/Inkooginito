import 'dotenv/config';

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const serverConfig = {
  appUrl: process.env.APP_URL?.replace(/\/$/, ''),
  appVersion: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  port: positiveInteger(process.env.PORT, 3000),
  jsonLimit: process.env.JSON_LIMIT || '5mb',
  maxStrokePoints: positiveInteger(process.env.MAX_STROKE_POINTS, 4000),
  maxRoomStrokes: positiveInteger(process.env.MAX_ROOM_STROKES, 10000),
  maxStickyNotes: positiveInteger(process.env.MAX_STICKY_NOTES, 500),
  maxChatMessages: positiveInteger(process.env.MAX_CHAT_MESSAGES, 200),
  roomTtlMs: positiveInteger(process.env.ROOM_TTL_MS, 4 * 60 * 60 * 1000),
  cleanupIntervalMs: positiveInteger(process.env.CLEANUP_INTERVAL_MS, 30 * 60 * 1000),
  disconnectGraceMs: positiveInteger(process.env.DISCONNECT_GRACE_MS, 45 * 1000),
  heartbeatIntervalMs: positiveInteger(process.env.HEARTBEAT_INTERVAL_MS, 25 * 1000),
  maxPayloadBytes: positiveInteger(process.env.WS_MAX_PAYLOAD_BYTES, 2 * 1024 * 1024)
};