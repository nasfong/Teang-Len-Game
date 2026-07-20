import type { Server, Socket } from 'socket.io'
import { DISCONNECT } from '../types/events'
import { findRoomBySocketId, getRoom } from '../rooms/roomStore'
import { markDisconnected } from '../services/roomService'
import { removeSpectatorSocket } from '../rooms/spectators'
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
