import type { Server, Socket } from 'socket.io'
import { CLIENT_EVENTS, SERVER_EVENTS } from '../types/events'
import { roomJoinSchema, roomPlayerSchema } from '../types/schemas'
import { getUserById } from '../modules/user/userStore'
import * as roomService from '../services/roomService'
import { addSpectator, removeSpectatorSocket } from '../rooms/spectators'
import { cancelAfkRemoval } from './afkTimers'
import { broadcastLobbyUpdate, broadcastRoomUpdate } from './emit'
import { parsePayload } from './parsePayload'

// room:join / leave / queue-leave / cancel-queue-leave / player:ready (spec §6.2).
export function registerRoomHandlers(io: Server, socket: Socket): void {
  socket.on(CLIENT_EVENTS.ROOM_JOIN, (payload: unknown) => {
    const data = parsePayload(socket, roomJoinSchema, payload)
    if (!data) return
    const name = getUserById(data.playerId)?.displayName ?? 'Player'
    const result = roomService.attachSocket(data.roomId, data.playerId, socket.id, name)
    if (!result.ok) {
      socket.emit(SERVER_EVENTS.ERROR, { message: result.error })
      return
    }
    const { room, role } = result.data
    // Track spectators for the live count; a seated player is never a spectator
    // (clear any stale entry in case a freed seat promoted them).
    if (role === 'spectator') addSpectator(data.roomId, socket.id)
    else removeSpectatorSocket(socket.id)
    // They're back (or newly here) — call off any pending AFK eviction. This is the
    // reconnect path too: useRoomChannel re-emits room:join on every reconnect.
    cancelAfkRemoval(data.roomId, data.playerId)
    socket.join(data.roomId)
    broadcastRoomUpdate(io, room)
  })

  socket.on(CLIENT_EVENTS.ROOM_LEAVE, (payload: unknown) => {
    const data = parsePayload(socket, roomPlayerSchema, payload)
    if (!data) return
    // A spectator leaving just drops off the watch list (they hold no seat).
    const specRoomId = removeSpectatorSocket(socket.id)
    if (specRoomId) {
      socket.leave(specRoomId)
      const watched = roomService.get(specRoomId)
      if (watched) broadcastRoomUpdate(io, watched) // count changed
      return
    }
    const room = roomService.get(data.roomId)
    if (!room) return
    // Mid-game, a leave is QUEUED (applied at match end); otherwise it's immediate.
    if (room.status === 'playing') {
      const queued = roomService.queueLeave(data.roomId, data.playerId)
      if (queued.ok) broadcastRoomUpdate(io, queued.data)
      return
    }
    socket.leave(data.roomId)
    const left = roomService.leave(data.roomId, data.playerId)
    if (left.ok) {
      if (left.data) broadcastRoomUpdate(io, left.data)
      broadcastLobbyUpdate(io) // seat freed or room removed
    }
  })

  socket.on(CLIENT_EVENTS.ROOM_QUEUE_LEAVE, (payload: unknown) => {
    const data = parsePayload(socket, roomPlayerSchema, payload)
    if (!data) return
    const result = roomService.queueLeave(data.roomId, data.playerId)
    if (result.ok) broadcastRoomUpdate(io, result.data)
  })

  socket.on(CLIENT_EVENTS.ROOM_CANCEL_QUEUE_LEAVE, (payload: unknown) => {
    const data = parsePayload(socket, roomPlayerSchema, payload)
    if (!data) return
    const result = roomService.cancelQueueLeave(data.roomId, data.playerId)
    if (result.ok) broadcastRoomUpdate(io, result.data)
  })

  socket.on(CLIENT_EVENTS.PLAYER_READY, (payload: unknown) => {
    const data = parsePayload(socket, roomPlayerSchema, payload)
    if (!data) return
    const result = roomService.setReady(data.roomId, data.playerId)
    if (result.ok) broadcastRoomUpdate(io, result.data)
  })
}
