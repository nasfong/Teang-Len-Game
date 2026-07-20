import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../net/api'
import { useSession } from '../state/session'
import { getSocket } from '../net/socket'
import { SERVER_EVENTS } from '../net/events'

// Friends data. One query returns the whole picture — accepted friends plus
// pending requests both ways — as { friends, incoming, outgoing }. Friends carry
// live status (online/playing/offline) derived on the server, so we let it go
// stale quickly and refetch on an interval: a friend coming online, or a new
// request arriving, shows up without a reload.
export function useFriends() {
  const token = useSession((s) => s.token)

  return useQuery({
    queryKey: ['friends'],
    enabled: Boolean(token),
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: () => apiFetch('/api/friends'),
  })
}

// Real-time friend updates. The server pushes a fresh { friends, incoming,
// outgoing } snapshot to our private socket room whenever anything changes — a
// request arrives, someone confirms/cancels, a friend comes online — so we drop it
// straight into the cache instead of waiting for the 30s poll. Mounted once, high
// in the tree, so requests land live even when the Friends modal is closed.
export function useFriendsRealtime() {
  const token = useSession((s) => s.token)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!token) return
    const socket = getSocket()
    const onUpdate = (state) => {
      queryClient.setQueryData(['friends'], state)
      // Relations in any open search (Add/Requested/Confirm/Added) may have moved.
      queryClient.invalidateQueries({ queryKey: ['user-search'] })
    }
    socket.on(SERVER_EVENTS.FRIENDS_UPDATE, onUpdate)
    return () => socket.off(SERVER_EVENTS.FRIENDS_UPDATE, onUpdate)
  }, [token, queryClient])
}

// User search for the "add friend" box. Disabled until the caller has typed
// something (the container debounces `query`); keeping previous data avoids the
// results flickering to empty between keystrokes. Each hit carries a `relation`
// (friend | incoming | outgoing | none) so the row shows the right control.
export function useUserSearch(query) {
  const token = useSession((s) => s.token)
  const q = query.trim()

  return useQuery({
    queryKey: ['user-search', q],
    enabled: Boolean(token) && q.length > 0,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { results } = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`)
      return results
    },
  })
}

// Every request-flow mutation returns the fresh { friends, incoming, outgoing }
// snapshot, so we seed the cache directly (no extra round-trip) and nudge any open
// search to re-flag its relations. This shared factory keeps the four identical.
function useFriendMutation(mutationFn) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (state) => {
      queryClient.setQueryData(['friends'], state)
      queryClient.invalidateQueries({ queryKey: ['user-search'] })
    },
  })
}

// Send a friend request (or auto-accept if they already requested you).
export function useSendRequest() {
  return useFriendMutation((userId) => apiFetch('/api/friends/requests', { method: 'POST', body: { userId } }))
}

// Confirm an incoming request → you're friends.
export function useAcceptRequest() {
  return useFriendMutation((userId) => apiFetch(`/api/friends/requests/${userId}/accept`, { method: 'POST' }))
}

// Decline an incoming request OR cancel one you sent (same endpoint).
export function useRemovePending() {
  return useFriendMutation((userId) => apiFetch(`/api/friends/requests/${userId}`, { method: 'DELETE' }))
}

// Remove an existing friend.
export function useRemoveFriend() {
  return useFriendMutation((friendId) => apiFetch(`/api/friends/${friendId}`, { method: 'DELETE' }))
}
