import type { Server } from 'socket.io'
import { getRoom } from '../rooms/roomStore'
import * as roomService from '../services/roomService'
import { broadcastLobbyUpdate, broadcastRoomUpdate } from './emit'

// Pending AFK removals, keyed per room+player.
//
// THE RULE: a disconnected player is only ever dropped from a room that is NOT
// mid-match. A live match is never interrupted to remove someone — during play the
// seat is held (a connected client bots their turns) and roomService.endGame() drops
// anyone still offline once the hand is over.
//
// So this timer covers exactly one case: someone who drops (or closes the tab) in a
// waiting room and never comes back, who would otherwise hold a seat forever and
// block the table from filling.
const timers = new Map<string, NodeJS.Timeout>()
const key = (roomId: string, playerId: string) => `${roomId}:${playerId}`

/** Cancel a pending removal — call on ANY sign of life (reconnect, rejoin). */
export function cancelAfkRemoval(roomId: string, playerId: string): void {
  const k = key(roomId, playerId)
  const timer = timers.get(k)
  if (!timer) return
  clearTimeout(timer)
  timers.delete(k)
}

/** Drop every pending removal for a room — it was deleted, or a match just started
 *  (during play the endGame sweep owns removals, not this timer). */
export function clearRoomAfkTimers(roomId: string): void {
  for (const k of [...timers.keys()]) {
    if (!k.startsWith(`${roomId}:`)) continue
    clearTimeout(timers.get(k)!)
    timers.delete(k)
  }
}

/** Start the countdown to remove a disconnected player from a non-playing room. */
export function armAfkRemoval(io: Server, roomId: string, playerId: string, ms: number): void {
  cancelAfkRemoval(roomId, playerId)
  const k = key(roomId, playerId)
  const timer = setTimeout(() => {
    timers.delete(k)
    const room = getRoom(roomId)
    if (!room) return
    const player = room.players.find((p) => p.playerId === playerId)
    // Already gone, or they reconnected while the clock ran — nothing to do.
    if (!player || player.socketId !== null) return
    // A match started in the meantime: hands off. endGame() will sweep them.
    if (room.status === 'playing') return

    const left = roomService.leave(roomId, playerId)
    if (!left.ok) return
    if (left.data) broadcastRoomUpdate(io, left.data)
    broadcastLobbyUpdate(io) // a seat freed, or the room disappeared
  }, ms)
  // Don't keep the process alive just for a pending eviction.
  timer.unref?.()
  timers.set(k, timer)
}
