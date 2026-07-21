// Domain types (spec §4). `gameState` is `unknown` at every layer — the backend
// stores and rebroadcasts it but never reads its fields.

import type { GameRules } from '../config/rules'

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'finished' | 'disconnected'

export interface Player {
  playerId: string // === User.id
  name: string // User.displayName at join time
  socketId: string | null // null when offline
  status: PlayerStatus
  seatIndex: number | null // 0–3
  connectedAt: number
  reconnectedAt: number | null
}

export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'finished'

export interface Room {
  roomId: string
  name: string
  gameId: string // which card game (see config/games.ts) — the server never reads its rules
  hostPlayerId: string
  betCoin: number // stake per seat (0 = free table)
  players: Player[]
  status: RoomStatus
  gameState: unknown // OPAQUE — never interpreted
  version: number
  createdAt: number
  updatedAt: number
  maxPlayers: number // 2–4
  turnStartedAt: number | null
  turnDurationMs: number
  pendingLeavePlayerIds: string[]
  rules: GameRules // server-owned rule variation, applied by the dealing client
}

// Public projections — the ONLY shapes exposed to clients. Never leak socketId
// or password hashes.
export interface PlayerSnapshot {
  playerId: string
  name: string
  status: PlayerStatus
  seatIndex: number | null
  isOnline: boolean
  coin: number // wallet balance, shown under the seat (settles at match end)
}

export interface RoomSnapshot {
  roomId: string
  name: string
  gameId: string // the client loads this game's module to render the room
  hostPlayerId: string
  betCoin: number
  players: PlayerSnapshot[]
  status: RoomStatus
  gameState: unknown
  version: number
  createdAt: number
  updatedAt: number
  maxPlayers: number
  turnStartedAt: number | null
  turnDurationMs: number
  pendingLeavePlayerIds: string[]
  spectatorCount: number // watchers with no seat (live count only, never socket ids)
  rules: GameRules // clients read this to deal the next match the same way
}

// Identity + wallet
export interface User {
  id: string
  username: string
  displayName: string
  passwordHash: string
  createdAt: number
}

export interface PublicUser {
  id: string
  username: string
  displayName: string
  createdAt: number
}

export type Currency = 'coin' | 'gem'

export interface Wallet {
  coin: number
  gem: number
}

// Services return this; controllers translate `code` into the HTTP status.
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: number }

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
export const fail = (error: string, code: number): ServiceResult<never> => ({ ok: false, error, code })

// A single ranking entry passed up from the frontend engine at match end.
export interface Ranking {
  playerId: string
  rank: number
}
