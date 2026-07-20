import type { Server, Socket } from 'socket.io'
import { CLIENT_EVENTS, LOBBY_ROOM, SERVER_EVENTS } from '../types/events'
import { toRoomSnapshot } from '../rooms/roomFactory'
import { listVisibleRooms } from '../services/roomService'

// Lobby subscription (lobby list realtime). A client watching the lobby joins the
// LOBBY_ROOM; broadcastLobbyUpdate then fans open-room changes out to all of them.
// Purely the room LIST — never game state, so no auth is required to watch it.
export function registerLobbyHandlers(_io: Server, socket: Socket): void {
  socket.on(CLIENT_EVENTS.LOBBY_SUBSCRIBE, () => {
    socket.join(LOBBY_ROOM)
    // Seed the newcomer with the current list immediately (don't wait for a change).
    socket.emit(SERVER_EVENTS.LOBBY_UPDATE, { rooms: listVisibleRooms().map(toRoomSnapshot) })
  })

  socket.on(CLIENT_EVENTS.LOBBY_UNSUBSCRIBE, () => {
    socket.leave(LOBBY_ROOM)
  })
}
