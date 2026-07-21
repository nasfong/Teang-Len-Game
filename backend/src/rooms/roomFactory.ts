import { randomUUID } from 'node:crypto'
import { getGame } from '../config/games'
import type { Player, PlayerSnapshot, Room, RoomSnapshot } from '../types'
import { spectatorCount } from './spectators'
import { getWallet } from '../modules/wallet/walletService'

// Room + participant construction and the public snapshot projections. Snapshots
// are the ONLY shapes exposed to clients — socketId never leaves this boundary.

export function createParticipant(input: { playerId: string; name: string; socketId?: string | null; seatIndex: number }): Player {
  return {
    playerId: input.playerId,
    name: input.name,
    socketId: input.socketId ?? null,
    status: 'waiting',
    seatIndex: input.seatIndex,
    connectedAt: Date.now(),
    reconnectedAt: null,
  }
}

export function createRoom(input: {
  name: string
  gameId?: string
  hostPlayerId: string
  hostName: string
  betCoin: number
  maxPlayers: number
}): Room {
  const now = Date.now()
  // The catalog is the authority on seat count, turn length and rule variation —
  // the request only chooses WHICH game, never its limits.
  const game = getGame(input.gameId)
  const host = createParticipant({ playerId: input.hostPlayerId, name: input.hostName, seatIndex: 0 })
  return {
    roomId: randomUUID(),
    name: input.name,
    gameId: game.id,
    hostPlayerId: input.hostPlayerId,
    betCoin: input.betCoin,
    players: [host],
    status: 'waiting',
    gameState: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    maxPlayers: Math.min(Math.max(input.maxPlayers, game.minPlayers), game.maxPlayers),
    turnStartedAt: null,
    turnDurationMs: game.turnDurationMs,
    pendingLeavePlayerIds: [],
    rules: game.rules,
  }
}

/** Lowest free seat index in [0, maxPlayers), or null if the room is full. */
export function nextAvailableSeat(room: Room): number | null {
  const taken = new Set(room.players.map((p) => p.seatIndex))
  for (let i = 0; i < room.maxPlayers; i++) {
    if (!taken.has(i)) return i
  }
  return null
}

export function toPlayerSnapshot(player: Player): PlayerSnapshot {
  return {
    playerId: player.playerId,
    name: player.name,
    status: player.status,
    seatIndex: player.seatIndex,
    isOnline: player.socketId !== null,
    coin: getWallet(player.playerId).coin,
  }
}

export function toRoomSnapshot(room: Room): RoomSnapshot {
  return {
    roomId: room.roomId,
    name: room.name,
    gameId: room.gameId,
    hostPlayerId: room.hostPlayerId,
    betCoin: room.betCoin,
    players: room.players.map(toPlayerSnapshot),
    status: room.status,
    gameState: room.gameState,
    version: room.version,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    maxPlayers: room.maxPlayers,
    turnStartedAt: room.turnStartedAt,
    turnDurationMs: room.turnDurationMs,
    pendingLeavePlayerIds: room.pendingLeavePlayerIds,
    spectatorCount: spectatorCount(room.roomId),
    rules: room.rules,
  }
}

/** Every room mutation goes through this (spec §8.7). */
export function bumpVersion(room: Room): Room {
  room.version += 1
  room.updatedAt = Date.now()
  return room
}
