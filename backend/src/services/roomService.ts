import type { Room, ServiceResult } from '../types'
import { fail, ok } from '../types'
import { bumpVersion, createParticipant, createRoom, nextAvailableSeat } from '../rooms/roomFactory'
import { deleteRoom, getRoom, listRooms, saveRoom } from '../rooms/roomStore'

// All room lifecycle mutations (spec §8). Wallet-FREE: money is orchestrated by
// controllers/handlers, never here. Returns ServiceResult so callers map `code`
// onto an HTTP status or a socket error.

const participant = (room: Room, playerId: string) => room.players.find((p) => p.playerId === playerId)

/**
 * Keep a usable host. The host is the only client that fires the next deal, so a
 * host who is gone OR merely offline deadlocks the room — everyone sits watching a
 * countdown that never starts. Reassign when the current host has left or is
 * disconnected.
 *
 * Picks the connected player in the LOWEST seat, not `players[0]`: the array order
 * follows join/leave churn, so it isn't stable across clients, whereas seat order
 * is the same everywhere. Falls back to the lowest seat outright if nobody is
 * connected (an all-offline room is about to be cleaned up anyway).
 */
function reassignHostIfNeeded(room: Room): void {
  if (room.players.length === 0) return
  const host = room.players.find((p) => p.playerId === room.hostPlayerId)
  if (host && host.socketId !== null) return // present and reachable

  const bySeat = [...room.players].sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
  const next = bySeat.find((p) => p.socketId !== null) ?? bySeat[0]
  room.hostPlayerId = next.playerId
}

// ── REST-facing ────────────────────────────────────────────────────────────

export function create(
  hostPlayerId: string,
  hostName: string,
  input: { name: string; gameId?: string; betCoin: number; maxPlayers: number },
): ServiceResult<Room> {
  const room = createRoom({
    hostPlayerId,
    hostName,
    name: input.name,
    gameId: input.gameId,
    betCoin: input.betCoin,
    maxPlayers: input.maxPlayers,
  })
  saveRoom(room)
  return ok(room)
}

export type JoinRole = 'player' | 'spectator'

/**
 * Join a room. Rooms never turn people away now:
 *  - a free seat → you take it (a PLAYER). Mid-game that's fine — you sit out the
 *    current hand and are dealt in on the next match.
 *  - no free seat → you enter as a SPECTATOR (no seat, watch only).
 * Idempotent for someone already seated (newSeat=false, no re-charge upstream).
 */
export function join(
  roomId: string,
  playerId: string,
  name: string,
): ServiceResult<{ room: Room; newSeat: boolean; role: JoinRole }> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  if (participant(room, playerId)) return ok({ room, newSeat: false, role: 'player' })
  const seat = nextAvailableSeat(room)
  if (seat === null) return ok({ room, newSeat: false, role: 'spectator' }) // full → watch
  room.players.push(createParticipant({ playerId, name, seatIndex: seat }))
  bumpVersion(room)
  return ok({ room, newSeat: true, role: 'player' })
}

/** Immediate removal (REST leave). Deletes an emptied room, transfers a vacated host. */
export function leave(roomId: string, playerId: string): ServiceResult<Room | null> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  room.players = room.players.filter((p) => p.playerId !== playerId)
  // Drop any queued leave for them too — otherwise the id outlives the player and
  // rides along in every snapshot as a phantom "leaving" marker.
  room.pendingLeavePlayerIds = room.pendingLeavePlayerIds.filter((id) => id !== playerId)
  if (room.players.length === 0) {
    deleteRoom(roomId)
    return ok(null)
  }
  reassignHostIfNeeded(room)
  bumpVersion(room)
  return ok(room)
}

// Rooms shown in the lobby: anything still live (waiting OR playing). A game in
// progress stays listed so others can still walk up — join an open seat to play the
// next match, or watch if it's full. Only finished/empty rooms drop off the list.
export function listVisibleRooms(): Room[] {
  return listRooms().filter((r) => r.status === 'waiting' || r.status === 'playing')
}

export function get(roomId: string): Room | undefined {
  return getRoom(roomId)
}

// ── Socket-facing ────────────────────────────────────────────────────────────

/** room:join — attach this socket. Reconnect if already seated, take a free seat,
 *  or (full room) attach as a spectator. `role` tells the caller which happened. */
export function attachSocket(
  roomId: string,
  playerId: string,
  socketId: string,
  name: string,
): ServiceResult<{ room: Room; role: JoinRole }> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  const seated = participant(room, playerId)
  if (seated) {
    seated.socketId = socketId
    seated.reconnectedAt = Date.now()
    if (seated.status === 'disconnected') seated.status = room.status === 'playing' ? 'playing' : 'waiting'
    bumpVersion(room)
    return ok({ room, role: 'player' })
  }
  const seat = nextAvailableSeat(room)
  // Room full → attach as a SPECTATOR: no seat, no player record (so no version
  // change); the caller still socket-joins them so they receive the live game.
  if (seat === null) return ok({ room, role: 'spectator' })
  // A free seat → become a player. Mid-game they start 'waiting' (createParticipant's
  // default), so they're not part of the current dealt hand — they're dealt in when
  // the next match's startGame flips everyone to 'playing'.
  room.players.push(createParticipant({ playerId, name, socketId, seatIndex: seat }))
  bumpVersion(room)
  return ok({ room, role: 'player' })
}

export function setReady(roomId: string, playerId: string): ServiceResult<Room> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  const p = participant(room, playerId)
  if (!p) return fail('Not a participant', 403)
  p.status = 'ready'
  bumpVersion(room)
  return ok(room)
}

export function queueLeave(roomId: string, playerId: string): ServiceResult<Room> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  if (!room.pendingLeavePlayerIds.includes(playerId)) room.pendingLeavePlayerIds.push(playerId)
  bumpVersion(room)
  return ok(room)
}

export function cancelQueueLeave(roomId: string, playerId: string): ServiceResult<Room> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  room.pendingLeavePlayerIds = room.pendingLeavePlayerIds.filter((id) => id !== playerId)
  bumpVersion(room)
  return ok(room)
}

export function startGame(
  roomId: string,
  hostPlayerId: string,
  initialGameState: unknown,
  turnDurationMs: number,
): ServiceResult<Room> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  if (room.hostPlayerId !== hostPlayerId) return fail('Only host can start the game', 403)
  if (room.status === 'playing') return fail('Game already started', 409)
  if (room.players.length < 2) return fail('Need at least 2 players', 409)
  room.status = 'playing'
  room.gameState = initialGameState
  room.turnStartedAt = null
  room.turnDurationMs = turnDurationMs
  room.pendingLeavePlayerIds = []
  room.players.forEach((p) => (p.status = 'playing'))
  bumpVersion(room)
  return ok(room)
}

export function applyGameState(roomId: string, playerId: string, gameState: unknown): ServiceResult<Room> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  if (room.status !== 'playing') return fail('Game is not in progress', 409)
  if (!participant(room, playerId)) return fail('Not a participant', 403)
  room.gameState = gameState
  bumpVersion(room)
  return ok(room)
}

export function markPlayerFinished(roomId: string, playerId: string): ServiceResult<{ room: Room; rank: number }> {
  const room = getRoom(roomId)
  if (!room) return fail('Room not found', 404)
  const p = participant(room, playerId)
  if (!p) return fail('Not a participant', 403)
  const rank = room.players.filter((x) => x.status === 'finished').length + 1
  p.status = 'finished'
  if (room.players.every((x) => x.status === 'finished')) room.status = 'finished'
  bumpVersion(room)
  return ok({ room, rank })
}

/**
 * After game:end — the one safe moment to remove people, since no hand is in
 * progress. Drops BOTH:
 *  - queued leaves ("Leave after match": they stayed for the hand, now they go), and
 *  - anyone still disconnected, i.e. they dropped mid-match and never came back.
 *    Mid-match they kept their seat so the game could finish; this is where they're
 *    finally cleared, never during play.
 * Then delete the room if it emptied, else reset it to waiting for the next deal.
 */
export function endGame(roomId: string): Room | null {
  const room = getRoom(roomId)
  if (!room) return null
  const drop = new Set(room.pendingLeavePlayerIds)
  for (const p of room.players) {
    if (p.socketId === null) drop.add(p.playerId)
  }
  if (drop.size > 0) {
    room.players = room.players.filter((p) => !drop.has(p.playerId))
  }
  if (room.players.length === 0) {
    deleteRoom(roomId)
    return null
  }
  room.status = 'waiting'
  room.gameState = null
  room.turnStartedAt = null
  room.pendingLeavePlayerIds = []
  room.players.forEach((p) => (p.status = p.socketId ? 'waiting' : 'disconnected'))
  reassignHostIfNeeded(room)
  bumpVersion(room)
  return room
}

/** Socket dropped — mark offline, keep the seat. Returns the affected room + player. */
export function markDisconnected(room: Room, socketId: string): { room: Room; playerId: string } | null {
  const p = room.players.find((x) => x.socketId === socketId)
  if (!p) return null
  p.status = 'disconnected'
  p.socketId = null
  // Hand the host off if it was them: the host is the only client that fires the
  // next deal, so a dropped host stalls a waiting room's auto-start until the AFK
  // timer removes them. reassignHostIfNeeded no-ops when the host is still
  // reachable, so this is safe to call unconditionally (mid-match included).
  reassignHostIfNeeded(room)
  bumpVersion(room)
  return { room, playerId: p.playerId }
}
