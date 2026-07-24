import type { Server, Socket } from 'socket.io'
import { config } from '../config'
import { DISCONNECT } from '../types/events'
import { findRoomBySocketId, getRoom } from '../rooms/roomStore'
import { markDisconnected } from '../services/roomService'
import { removeSpectatorSocket } from '../rooms/spectators'
import { armAfkRemoval, armRoomReap } from './afkTimers'
import { broadcastPlayerDisconnected, broadcastRoomUpdate } from './emit'

// Socket dropped → mark the player offline (seat retained) and broadcast (spec §10).
// A dropped SPECTATOR just leaves the watch list — rebroadcast so the live count
// falls. The offline player's seat now reads AFK on clients, and a connected client
// plays a bot move for them so the game doesn't stall.
export function registerDisconnectHandler(io: Server, socket: Socket): void {
  socket.on(DISCONNECT, () => {
    const room = findRoomBySocketId(socket.id)
    if (room) {
      const result = markDisconnected(room, socket.id)
      if (!result) return
      // Start the eviction clock. It only fires if the room ISN'T mid-match and they
      // haven't come back — a live match is never interrupted (endGame sweeps
      // players who never reconnected).
      armAfkRemoval(io, room.roomId, result.playerId, config.afk.disconnectGraceMs)
      // If that drop emptied a LIVE match of every connected seat, nobody is left
      // to drive the hand to its end — arm the orphan reaper so the table doesn't
      // sit in 'playing' forever. Cancelled the instant any seat reconnects.
      if (result.room.status === 'playing' && result.room.players.every((p) => p.socketId === null)) {
        armRoomReap(io, room.roomId, config.afk.orphanReapMs)
      }
      broadcastPlayerDisconnected(io, room.roomId, result.playerId)
      broadcastRoomUpdate(io, result.room)
      return
    }
    // Not a seated player — maybe a spectator.
    const specRoomId = removeSpectatorSocket(socket.id)
    if (specRoomId) {
      const watched = getRoom(specRoomId)
      if (watched) broadcastRoomUpdate(io, watched)
    }
  })
}
