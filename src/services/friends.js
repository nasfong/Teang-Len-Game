import { apiFetch } from './http'

// Friend requests. Every mutation returns the WHOLE fresh picture
// ({ friends, incoming, outgoing }), which is why the hooks can seed the cache
// straight from a mutation response instead of refetching.

export function getFriends() {
  return apiFetch('/api/friends')
}

export async function searchUsers(query) {
  const { results } = await apiFetch(`/api/users/search?q=${encodeURIComponent(query)}`)
  return results
}

/** Send a friend request — or auto-accept, if they already requested you. */
export function sendFriendRequest(userId) {
  return apiFetch('/api/friends/requests', { method: 'POST', body: { userId } })
}

export function acceptFriendRequest(userId) {
  return apiFetch(`/api/friends/requests/${userId}/accept`, { method: 'POST' })
}

/** Decline an incoming request OR cancel one you sent — same endpoint. */
export function removePendingRequest(userId) {
  return apiFetch(`/api/friends/requests/${userId}`, { method: 'DELETE' })
}

export function removeFriend(friendId) {
  return apiFetch(`/api/friends/${friendId}`, { method: 'DELETE' })
}
