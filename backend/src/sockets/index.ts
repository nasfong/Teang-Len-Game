import type { Server } from 'socket.io'
import { CONNECTION } from '../types/events'
import { registerDisconnectHandler } from './disconnectHandler'
import { registerGameHandlers } from './gameHandlers'
import { registerLobbyHandlers } from './lobbyHandlers'
import { trackPresence } from './presence'
import { registerRoomHandlers } from './roomHandlers'

// Register lobby, room, game, and disconnect handlers for each new connection (spec §6.1).
export function registerSocketHandlers(io: Server): void {
  io.on(CONNECTION, (socket) => {
    trackPresence(io, socket) // count this socket toward its user's online presence
    registerLobbyHandlers(io, socket)
    registerRoomHandlers(io, socket)
    registerGameHandlers(io, socket)
    registerDisconnectHandler(io, socket)
  })
}
