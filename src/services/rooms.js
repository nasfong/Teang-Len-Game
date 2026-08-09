import { apiFetch } from './http'

// Room requests — one function per endpoint, no React, no cache policy (that's
// api/useRooms.js). Non-React callers use these too (cold-boot room recovery).

export async function listRooms() {
  const { rooms } = await apiFetch('/api/rooms')
  return rooms
}

export async function getRoom(roomId) {
  const { room } = await apiFetch(`/api/rooms/${roomId}`)
  return room
}

/** The room the caller is already seated in, or null. */
export async function getActiveRoom() {
  const { room } = await apiFetch('/api/rooms/active')
  return room ?? null
}

/** @param payload {{ name, gameCode, betCoin, maxPlayers }} */
export function createRoom(payload) {
  return apiFetch('/api/rooms', { method: 'POST', body: payload })
}

export function joinRoom(roomId) {
  return apiFetch(`/api/rooms/${roomId}/join`, { method: 'POST' })
}

export function inviteToRoom(roomId, userId) {
  return apiFetch(`/api/rooms/${roomId}/invite`, { method: 'POST', body: { userId } })
}
