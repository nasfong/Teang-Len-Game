// Spectators — sockets watching a room without holding a seat (they joined a full
// room, or are sitting out a hand they arrived mid-way through). Tracked OUTSIDE
// the Room object (like the turn timers): they're per-socket and transient, and the
// Room only exposes a COUNT to clients, never socket ids.
const byRoom = new Map<string, Set<string>>() // roomId → spectator socketIds
const roomOf = new Map<string, string>() // socketId → roomId (for disconnect cleanup)

export function addSpectator(roomId: string, socketId: string): void {
  removeSpectatorSocket(socketId) // can only spectate one room at a time
  let set = byRoom.get(roomId)
  if (!set) {
    set = new Set()
    byRoom.set(roomId, set)
  }
  set.add(socketId)
  roomOf.set(socketId, roomId)
}

/** Drop a socket from whatever room it was watching. Returns that roomId (so the
 *  caller can rebroadcast the new count) or null if it wasn't a spectator. */
export function removeSpectatorSocket(socketId: string): string | null {
  const roomId = roomOf.get(socketId)
  if (!roomId) return null
  roomOf.delete(socketId)
  const set = byRoom.get(roomId)
  if (set) {
    set.delete(socketId)
    if (set.size === 0) byRoom.delete(roomId)
  }
  return roomId
}

export function spectatorCount(roomId: string): number {
  return byRoom.get(roomId)?.size ?? 0
}
