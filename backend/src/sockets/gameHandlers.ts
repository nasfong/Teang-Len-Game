import type { Server, Socket } from 'socket.io'
import { config } from '../config'
import { CLIENT_EVENTS, SERVER_EVENTS } from '../types/events'
import { gamePlaySchema, gameSkipSchema, gameStartSchema } from '../types/schemas'
import type { Ranking, Settlement } from '../types'
import { getGame } from '../config/games'
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
import { clearRoomAfkTimers } from './afkTimers'
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
    // A match is starting: cancel pending AFK evictions. Nobody is removed mid-hand;
    // endGame() sweeps anyone who never reconnected.
    clearRoomAfkTimers(room.roomId)
    broadcastRoomUpdate(io, room)
    broadcastLobbyUpdate(io) // status changed — refresh the lobby list
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
      // Settle the pot BEFORE game:end so each client's wallet refetch reads it, and
      // carry the per-player deltas in the event so each seat can show its +/−.
      const settlements = settlePot(room.roomId, rankings)
      broadcastGameEnd(io, room.roomId, rankings, room.gameState, settlements)
      const reset = roomService.endGame(room.roomId)
      if (reset) broadcastRoomUpdate(io, reset)
      // endGame may have removed players (queued leaves, never-reconnected) or
      // deleted the room outright — the lobby's seat counts are now stale.
      broadcastLobbyUpdate(io)
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

// Settle every participant's wallet at match end. Read the room BEFORE endGame()
// resets it; free tables (betCoin ≤ 0) are a no-op. The bet amount and the payout
// MODEL are server-owned (getGame + room.betCoin) — a client only asserts who
// placed where via `rankings`, never how much money moves.
//
// `rankings` lists exactly the players who were in this hand (a mid-hand joiner
// sitting the round out isn't in it), so it also defines who is charged.
function settlePot(roomId: string, rankings: Ranking[]): Settlement[] {
  const room = roomService.get(roomId)
  if (!room || room.betCoin <= 0 || rankings.length === 0) return []

  // Move the coins and record the delta in one place, so the number broadcast to the
  // seats is exactly the number applied to the wallet (both rounded the same way).
  const settlements: Settlement[] = []
  const apply = (playerId: string, delta: number): void => {
    const rounded = Math.round(delta)
    if (rounded === 0) return
    settle(playerId, rounded)
    settlements.push({ playerId, delta: rounded })
  }

  if (getGame(room.gameId).payout === 'winner-take-all') {
    // §4 — one winner (rank 1) sweeps one bet from every other participant. Zero-sum
    // and seat-count-agnostic (Kanteal seats 2–8), and each loser drops exactly one
    // bet, the worst case the join-time affordability check already guaranteed. Split
    // evenly if a game ever ends in a tie for first (Kanteal doesn't, but be safe).
    const winners = rankings.filter((r) => r.rank === 1)
    const losers = rankings.filter((r) => r.rank !== 1)
    if (winners.length === 0 || losers.length === 0) return []
    const pot = losers.length * room.betCoin
    const share = Math.floor(pot / winners.length)
    for (const { playerId } of losers) apply(playerId, -room.betCoin)
    for (const { playerId } of winners) apply(playerId, share)
    return settlements
  }

  // 'placement' — pay each finisher by their rank.
  const multipliers = PAYOUT_MULTIPLIERS[rankings.length]
  if (!multipliers) return []
  for (const { playerId, rank } of rankings) {
    const multiplier = multipliers[rank - 1]
    if (multiplier == null) continue
    apply(playerId, multiplier * room.betCoin)
  }
  return settlements
}
