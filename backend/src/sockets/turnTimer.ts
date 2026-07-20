import type { Server } from 'socket.io'
import { SERVER_EVENTS } from '../types/events'
import { getRoom } from '../rooms/roomStore'

// One setTimeout per room, tracked OUTSIDE the Room object (timeouts aren't
// serializable) — spec §7. The backend only emits turn:timeout; it never auto-plays.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** (Re)start the room's turn timer. Records turnStartedAt on the room for refresh
 *  recovery and returns it, or null if there's no timer (duration ≤ 0 / no room). */
export function startTurnTimer(io: Server, roomId: string, durationMsOverride?: number): number | null {
  clearTurnTimer(roomId)
  const room = getRoom(roomId)
  if (!room) return null
  const durationMs = durationMsOverride ?? room.turnDurationMs
  if (durationMs <= 0) return null

  const turnStartedAt = Date.now()
  room.turnStartedAt = turnStartedAt
  const handle = setTimeout(() => {
    io.to(roomId).emit(SERVER_EVENTS.TURN_TIMEOUT, { roomId })
  }, durationMs)
  timers.set(roomId, handle)
  return turnStartedAt
}

export function clearTurnTimer(roomId: string): void {
  const handle = timers.get(roomId)
  if (handle) {
    clearTimeout(handle)
    timers.delete(roomId)
  }
}
