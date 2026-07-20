import type { Server, Socket } from 'socket.io'
import { config } from '../config'
import { CLIENT_EVENTS, SERVER_EVENTS } from '../types/events'
import { gamePlaySchema, gameSkipSchema, gameStartSchema } from '../types/schemas'
import type { Ranking } from '../types'
import { settle } from '../modules/wallet/walletService'
import * as roomService from '../services/roomService'
import {
  broadcastGameEnd,
  broadcastGameUpdate,
  broadcastLobbyUpdate,
  broadcastPlayerFinished,
  broadcastRoomUpdate,
} from './emit'
import { parsePayload } from './parsePayload'
import { clearTurnTimer, startTurnTimer } from './turnTimer'

// game:start / game:play / game:skip (spec §6.2, §7, §9). gameState is opaque here.
const clampTurnMs = (seconds?: number): number => {
  if (seconds == null) return config.defaultTurnDurationMs
  const { min, max } = config.turnClampSeconds
  return Math.min(max, Math.max(min, seconds)) * 1000
}

export function registerGameHandlers(io: Server, socket: Socket): void {
  socket.on(CLIENT_EVENTS.GAME_START, (payload: unknown) => {
    const data = parsePayload(socket, gameStartSchema, payload)
    if (!data) return
    const durationMs = clampTurnMs(data.secondsPerTurn)
    const result = roomService.startGame(data.roomId, data.playerId, data.initialGameState, durationMs)
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.ERROR, { message: result.error })
      return
    }
    const room = result.data
    broadcastRoomUpdate(io, room)
    broadcastLobbyUpdate(io) // room left 'waiting' — drop it from the lobby list
    const turnStartedAt = startTurnTimer(io, room.roomId, durationMs)
    broadcastGameUpdate(io, room.roomId, room.gameState, room.version, data.playerId, turnStartedAt ?? undefined)
  })

  socket.on(CLIENT_EVENTS.GAME_PLAY, (payload: unknown) => {
    const data = parsePayload(socket, gamePlaySchema, payload)
    if (!data) return
    const applied = roomService.applyGameState(data.roomId, data.playerId, data.gameState)
    if (!applied.ok) {
      socket.emit(SERVER_EVENTS.ERROR, { message: applied.error })
      return
    }
    const room = applied.data

    // Timer: clear on game over, else restart for the next turn.
    let turnStartedAt: number | undefined
    if (data.gameOver) clearTurnTimer(room.roomId)
    else turnStartedAt = startTurnTimer(io, room.roomId, room.turnDurationMs) ?? undefined

    broadcastGameUpdate(io, room.roomId, room.gameState, room.version, data.playerId, turnStartedAt)

    if (data.playerFinished) {
      const finished = roomService.markPlayerFinished(room.roomId, data.playerId)
      if (finished.ok) broadcastPlayerFinished(io, room.roomId, data.playerId, finished.data.rank)
    }

    if (data.gameOver) {
      const rankings: Ranking[] = data.rankings ?? []
      // Settle the pot BEFORE game:end so each client's wallet refetch reads it.
      settlePot(room.roomId, rankings)
      broadcastGameEnd(io, room.roomId, rankings, room.gameState)
      const reset = roomService.endGame(room.roomId)
      if (reset) broadcastRoomUpdate(io, reset)
    }
  })

  socket.on(CLIENT_EVENTS.GAME_SKIP, (payload: unknown) => {
    const data = parsePayload(socket, gameSkipSchema, payload)
    if (!data) return
    const applied = roomService.applyGameState(data.roomId, data.playerId, data.gameState)
    if (!applied.ok) {
      socket.emit(SERVER_EVENTS.ERROR, { message: applied.error })
      return
    }
    const room = applied.data
    const turnStartedAt = startTurnTimer(io, room.roomId, room.turnDurationMs) ?? undefined
    broadcastGameUpdate(io, room.roomId, room.gameState, room.version, data.playerId, turnStartedAt)
  })
}

// Placement payouts as multiples of the bet, by player count. Zero-sum: the
// winners' gains exactly cover the losers' losses, and last place always loses one
// full bet — the amount the join-time affordability check guarantees each can pay.
// e.g. bet 5000, 4 players → +5000 / +2500 / −2500 / −5000.
const PAYOUT_MULTIPLIERS: Record<number, number[]> = {
  2: [1, -1],
  3: [1.5, -0.5, -1],
  4: [1, 0.5, -0.5, -1],
}

// Settle every player's wallet by finishing place at match end. Read the room
// BEFORE endGame() resets it. Free table (betCoin ≤ 0) is a no-op.
function settlePot(roomId: string, rankings: Ranking[]): void {
  const room = roomService.get(roomId)
  if (!room || room.betCoin <= 0) return
  const multipliers = PAYOUT_MULTIPLIERS[rankings.length]
  if (!multipliers) return
  for (const { playerId, rank } of rankings) {
    const multiplier = multipliers[rank - 1]
    if (multiplier == null) continue
    settle(playerId, multiplier * room.betCoin)
  }
}
