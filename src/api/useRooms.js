import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as roomService from '../services/rooms'
import { roomSnapshotToCard } from '../services/adapters'
import { connectSocket } from '../services/socket'
import { CLIENT_EVENTS, SERVER_EVENTS } from '../services/events'
import { useSession } from '../stores/session'
import { queryKeys } from './keys'

// Room server-state, via TanStack Query. The REQUESTS live in services/rooms.js;
// this file owns only cache policy — keys, freshness, invalidation, and the socket
// stream that keeps the lobby live.
//
// The lobby is driven by a WEBSOCKET stream: on mount we subscribe to the server's
// lobby room and write each `lobby:update` straight into the query cache, so the
// list reflects other players in real time. The query's own poll is just a slow
// SAFETY NET (30s) in case the socket drops. create/join are MUTATIONS that charge
// the wallet server-side — on success we mirror the balance into the session.

export function useRooms() {
  const token = useSession((s) => s.token)
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.rooms,
    enabled: Boolean(token),
    // Fallback only — the socket is the primary freshness source below.
    refetchInterval: 30_000,
    queryFn: async () => (await roomService.listRooms()).map(roomSnapshotToCard),
  })

  // Live lobby: subscribe while this screen is mounted; each push replaces the
  // cached list. We stay subscribed to the shared socket but don't disconnect it
  // on unmount — the table screen reuses the same connection.
  useEffect(() => {
    if (!token) return
    const socket = connectSocket()
    const onLobby = ({ rooms }) => qc.setQueryData(queryKeys.rooms, rooms.map(roomSnapshotToCard))

    socket.on(SERVER_EVENTS.LOBBY_UPDATE, onLobby)
    const subscribe = () => socket.emit(CLIENT_EVENTS.LOBBY_SUBSCRIBE)
    subscribe()
    // Re-subscribe after any reconnect (a fresh socket isn't in the lobby room).
    socket.on('connect', subscribe)

    return () => {
      socket.emit(CLIENT_EVENTS.LOBBY_UNSUBSCRIBE)
      socket.off(SERVER_EVENTS.LOBBY_UPDATE, onLobby)
      socket.off('connect', subscribe)
    }
  }, [token, qc])

  return query
}

// A single room's raw snapshot — the table screen's initial data before the socket
// channel starts pushing room:update. Returns the server RoomSnapshot as-is.
export function useRoom(roomId) {
  const token = useSession((s) => s.token)

  return useQuery({
    queryKey: queryKeys.room(roomId),
    enabled: Boolean(token && roomId),
    queryFn: () => roomService.getRoom(roomId),
  })
}

// Shared by create and join: both charge the wallet server-side, so both mirror the
// returned balance into the session and refetch the lobby.
function useRoomMutation(mutationFn) {
  const qc = useQueryClient()
  const setWallet = useSession((s) => s.setWallet)

  return useMutation({
    mutationFn,
    onSuccess: ({ wallet }) => {
      if (wallet) setWallet(wallet)
      qc.invalidateQueries({ queryKey: queryKeys.rooms })
    },
  })
}

export function useCreateRoom() {
  return useRoomMutation(roomService.createRoom)
}

export function useJoinRoom() {
  return useRoomMutation(roomService.joinRoom)
}

// Invite a friend into a room you're in. Fire-and-forget from the caller's side —
// the server rings the friend over the socket; the response just confirms it went.
// `variables` is the friendId, so the panel can flag which row is in flight.
export function useInviteToRoom(roomId) {
  return useMutation({
    mutationFn: (userId) => roomService.inviteToRoom(roomId, userId),
  })
}
