import { apiFetch } from './http'

// Friend requests. Every mutation returns the whole fresh
// { friends, incoming, outgoing }, which is why the hooks seed the cache from the
// response instead of refetching.

export function getFriends() {
  return apiFetch('/api/friends')
}

export async function searchUsers(query) {
  const { results } = await apiFetch(`/api/users/search?q=${encodeURIComponent(query)}`)
  return results
}

/** Send a request — or auto-accept, if they already requested you. */
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
