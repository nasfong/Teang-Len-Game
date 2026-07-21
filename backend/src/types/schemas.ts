import { z } from 'zod'
import { gameIds, DEFAULT_GAME_ID } from '../config/games'

// Zod schemas for REST bodies/params and socket payloads (spec §5.1, §6.2).

// ── REST ──────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3–20 letters, numbers or underscore'),
  password: z.string().min(6).max(72),
  displayName: z.string().trim().min(1).max(24).optional(),
})

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(24),
  // Which game to host. Validated against the catalog so an unknown id is a 400
  // rather than a room nobody can render; the seat count it implies is applied
  // server-side in createRoom, not taken from the request.
  gameId: z.enum(gameIds as [string, ...string[]]).default(DEFAULT_GAME_ID),
  betCoin: z.number().int().min(0),
  // Outer bound only — createRoom clamps this into the CHOSEN game's range.
  maxPlayers: z.number().int().min(2).max(8).default(4),
})

export const roomIdParamSchema = z.object({
  roomId: z.string().uuid(),
})

// Friends — search by free-text query; requests/friends keyed by user id.
export const userSearchSchema = z.object({
  q: z.string().trim().min(1, 'Type a name to search').max(40),
})

export const friendRequestSchema = z.object({
  userId: z.string().uuid(),
})

export const userIdParamSchema = z.object({
  userId: z.string().uuid(),
})

export const friendIdParamSchema = z.object({
  friendId: z.string().uuid(),
})

// ── Socket ──────────────────────────────────────────────────────────────────
export const roomJoinSchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
})

// room:leave / queue-leave / cancel-queue-leave / player:ready share this shape.
export const roomPlayerSchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
})

export const gameStartSchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
  initialGameState: z.unknown(),
  secondsPerTurn: z.number().int().positive().optional(),
})

export const gamePlaySchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
  gameState: z.unknown(),
  playerFinished: z.boolean().optional(),
  finishedRank: z.number().int().optional(),
  gameOver: z.boolean().optional(),
  rankings: z.array(z.object({ playerId: z.string(), rank: z.number().int() })).optional(),
})

export const gameSkipSchema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
  gameState: z.unknown(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type RoomJoinPayload = z.infer<typeof roomJoinSchema>
export type RoomPlayerPayload = z.infer<typeof roomPlayerSchema>
export type GameStartPayload = z.infer<typeof gameStartSchema>
export type GamePlayPayload = z.infer<typeof gamePlaySchema>
export type GameSkipPayload = z.infer<typeof gameSkipSchema>
