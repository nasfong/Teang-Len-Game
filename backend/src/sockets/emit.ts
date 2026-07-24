import type { Server } from 'socket.io'
import { LOBBY_ROOM, SERVER_EVENTS, userRoom } from '../types/events'
import { toRoomSnapshot } from '../rooms/roomFactory'
import { listVisibleRooms } from '../services/roomService'
import { getFriendIds, getFriendState } from '../modules/friend/friendService'
import type { Ranking, Room, Settlement } from '../types'

// Typed broadcast helpers — all server→client emits funnel through here so event
// names come only from SERVER_EVENTS and rooms are always snapshotted first.

export function broadcastRoomUpdate(io: Server, room: Room): void {
  io.to(room.roomId).emit(SERVER_EVENTS.ROOM_UPDATE, { room: toRoomSnapshot(room) })
}

// The whole open-room list, pushed to every lobby subscriber. Call after any
// action that adds/removes a waiting room or changes its occupancy (create, join,
// leave, game start) so the lobby stays live without the client polling.
export function broadcastLobbyUpdate(io: Server): void {
  io.to(LOBBY_ROOM).emit(SERVER_EVENTS.LOBBY_UPDATE, { rooms: listVisibleRooms().map(toRoomSnapshot) })
}

export function broadcastGameUpdate(
  io: Server,
  roomId: string,
  gameState: unknown,
  version: number,
  triggeredBy: string,
  turnStartedAt?: number,
): void {
  io.to(roomId).emit(SERVER_EVENTS.GAME_UPDATE, { roomId, gameState, version, triggeredBy, turnStartedAt })
}

export function broadcastPlayerFinished(io: Server, roomId: string, playerId: string, rank: number): void {
  io.to(roomId).emit(SERVER_EVENTS.PLAYER_FINISHED, { roomId, playerId, rank })
}

export function broadcastGameEnd(
  io: Server,
  roomId: string,
  rankings: Ranking[],
  gameState: unknown,
  settlements: Settlement[] = [],
): void {
  io.to(roomId).emit(SERVER_EVENTS.GAME_END, { roomId, rankings, gameState, settlements })
}

export function broadcastPlayerDisconnected(io: Server, roomId: string, playerId: string): void {
  io.to(roomId).emit(SERVER_EVENTS.PLAYER_DISCONNECTED, { roomId, playerId })
}

// Push one user's fresh friend snapshot ({ friends, incoming, outgoing }) to their
// private room — every tab they have open updates at once. Computed per-recipient
// because each side sees the relationship from their own perspective.
export function emitFriendsUpdate(io: Server, userId: string): void {
  io.to(userRoom(userId)).emit(SERVER_EVENTS.FRIENDS_UPDATE, getFriendState(userId))
}

// Fan a presence change out to everyone who has this user as a friend, so their
// lists flip them online/offline live (their OWN list doesn't change, so we skip
// the user themselves).
export function notifyFriendsOfPresence(io: Server, userId: string): void {
  for (const friendId of getFriendIds(userId)) emitFriendsUpdate(io, friendId)
}

export interface RoomInvite {
  roomId: string
  roomName: string
  betCoin: number
  from: { id: string; name: string }
}

// Ring one friend with an invite to a room, pushed to their private room so it
// pops on whatever screen they're on (the client shows a slide-in confirm card).
export function emitRoomInvite(io: Server, targetId: string, invite: RoomInvite): void {
  io.to(userRoom(targetId)).emit(SERVER_EVENTS.ROOM_INVITE, invite)
}
