import type { Server } from 'socket.io'
import { deleteRoom, getRoom } from '../rooms/roomStore'
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
 *  (during play the endGame sweep owns removals, not this timer). Also cancels a
 *  pending orphan reap (a fresh match means the room is live again). */
export function clearRoomAfkTimers(roomId: string): void {
  for (const k of [...timers.keys()]) {
    if (!k.startsWith(`${roomId}:`)) continue
    clearTimeout(timers.get(k)!)
    timers.delete(k)
  }
  cancelRoomReap(roomId)
}

// ── Orphan reap ──────────────────────────────────────────────────────────────
//
// A separate, room-level timer for the one case the per-player AFK timer above
// deliberately ignores: a PLAYING room where EVERY seat has gone offline. The AFK
// timer never fires during a live match (a connected client bots the missing turns
// so the hand can finish), but once nobody is connected there's no client to drive
// it — the hand can never end and endGame() never runs, so the room would sit in
// 'playing' forever. This reaps it. No wallet settlement: an abandoned hand has no
// result.
const reapTimers = new Map<string, NodeJS.Timeout>()

/** Cancel a pending orphan reap — call the moment any seat reconnects. */
export function cancelRoomReap(roomId: string): void {
  const timer = reapTimers.get(roomId)
  if (!timer) return
  clearTimeout(timer)
  reapTimers.delete(roomId)
}

/** Arm the reap for a fully-abandoned playing room. Idempotent (re-arming resets
 *  the clock). Fires only if the room is STILL playing with every seat offline. */
export function armRoomReap(io: Server, roomId: string, ms: number): void {
  cancelRoomReap(roomId)
  const timer = setTimeout(() => {
    reapTimers.delete(roomId)
    const room = getRoom(roomId)
    if (!room) return
    // Someone came back, or the hand ended, in the meantime — stand down.
    if (room.status !== 'playing') return
    if (room.players.some((p) => p.socketId !== null)) return
    deleteRoom(roomId)
    broadcastLobbyUpdate(io) // the table vanishes from the lobby
  }, ms)
  timer.unref?.()
  reapTimers.set(roomId, timer)
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
