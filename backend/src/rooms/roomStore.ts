import type { Room } from '../types'

// In-memory room store (spec §2). Map<roomId, Room>.
const rooms = new Map<string, Room>()

export function saveRoom(room: Room): Room {
  rooms.set(room.roomId, room)
  return room
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId)
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId)
}

export function listRooms(): Room[] {
  return [...rooms.values()]
}

/** The (at most one) room a socket belongs to — used by the disconnect handler. */
export function findRoomBySocketId(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room
  }
  return undefined
}

/**
 * The live room a PLAYER is seated in — the basis for cold-boot recovery ("which
 * room am I in?"). Unlike findRoomBySocketId this matches on the durable playerId,
 * so it survives a dropped socket / refresh. Only a live `waiting`/`playing` room
 * is returned — a `finished` room is transient (endGame resets or deletes it) and
 * holds nothing to rejoin. Spectators keep no player record, so they're
 * intentionally not recoverable this way.
 */
export function findRoomByPlayerId(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.status !== 'waiting' && room.status !== 'playing') continue
    if (room.players.some((p) => p.playerId === playerId)) return room
  }
  return undefined
}
