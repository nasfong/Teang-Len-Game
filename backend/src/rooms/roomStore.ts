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
