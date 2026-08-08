import { apiFetch } from './http'

// Room requests — one function per backend endpoint, no React and no cache policy.
// Caching, invalidation and the socket stream live in api/useRooms.js; keeping the
// requests here means non-React callers (the cold-boot active-room recovery) hit the
// same definitions instead of hand-writing a path.

export async function listRooms() {
  const { rooms } = await apiFetch('/api/rooms')
  return rooms
}

export async function getRoom(roomId) {
  const { room } = await apiFetch(`/api/rooms/${roomId}`)
  return room
}

// The room the caller is already seated in, or null. Used once per app launch to
// send a returning player back to their table.
export async function getActiveRoom() {
  const { room } = await apiFetch('/api/rooms/active')
  return room ?? null
}

/** @param payload {{ name, gameCode, betCoin, maxPlayers }} — see the backend's createRoomSchema. */
export function createRoom(payload) {
  return apiFetch('/api/rooms', { method: 'POST', body: payload })
}

export function joinRoom(roomId) {
  return apiFetch(`/api/rooms/${roomId}/join`, { method: 'POST' })
}

export function inviteToRoom(roomId, userId) {
  return apiFetch(`/api/rooms/${roomId}/invite`, { method: 'POST', body: { userId } })
}
