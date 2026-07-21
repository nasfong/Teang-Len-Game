import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../net/api'
import { roomSnapshotToCard } from '../net/adapters'
import { connectSocket } from '../net/socket'
import { CLIENT_EVENTS, SERVER_EVENTS } from '../net/events'
import { useSession } from '../state/session'

// Room server-state, via TanStack Query.
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
    queryKey: ['rooms'],
    enabled: Boolean(token),
    // Fallback only — the socket is the primary freshness source below.
    refetchInterval: 30_000,
    queryFn: async () => {
      const { rooms } = await apiFetch('/api/rooms')
      return rooms.map(roomSnapshotToCard)
    },
  })

  // Live lobby: subscribe while this screen is mounted; each push replaces the
  // cached list. We stay subscribed to the shared socket but don't disconnect it
  // on unmount — the table screen reuses the same connection.
  useEffect(() => {
    if (!token) return
    const socket = connectSocket()
    const onLobby = ({ rooms }) => qc.setQueryData(['rooms'], rooms.map(roomSnapshotToCard))

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
    queryKey: ['room', roomId],
    enabled: Boolean(token && roomId),
    queryFn: async () => {
      const { room } = await apiFetch(`/api/rooms/${roomId}`)
      return room
    },
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  const setWallet = useSession((s) => s.setWallet)

  return useMutation({
    // { name, gameId, betCoin, maxPlayers } — see createRoomSchema.
    mutationFn: (payload) => apiFetch('/api/rooms', { method: 'POST', body: payload }),
    onSuccess: ({ wallet }) => {
      if (wallet) setWallet(wallet)
      qc.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useJoinRoom() {
  const qc = useQueryClient()
  const setWallet = useSession((s) => s.setWallet)

  return useMutation({
    mutationFn: (roomId) => apiFetch(`/api/rooms/${roomId}/join`, { method: 'POST' }),
    onSuccess: ({ wallet }) => {
      if (wallet) setWallet(wallet)
      qc.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

// Invite a friend into a room you're in. Fire-and-forget from the caller's side —
// the server rings the friend over the socket; the response just confirms it went.
// `variables` is the friendId, so the panel can flag which row is in flight.
export function useInviteToRoom(roomId) {
  return useMutation({
    mutationFn: (userId) => apiFetch(`/api/rooms/${roomId}/invite`, { method: 'POST', body: { userId } }),
  })
}
