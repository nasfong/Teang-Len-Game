import type { Server, Socket } from 'socket.io'
import { DISCONNECT, userRoom } from '../types/events'
import { verifyToken } from '../modules/auth/token'
import { notifyFriendsOfPresence } from './emit'

// Live presence — how many sockets each user currently has open. A user counts as
// "online" while at least one is connected (a browser can hold more than one tab,
// hence a count rather than a boolean). Identity comes from the VERIFIED handshake
// token, so a forged token can't claim someone else's presence; an unauthenticated
// socket (e.g. a lobby watcher before login) simply isn't tracked.
const socketCounts = new Map<string, number>()

// Called once per new connection from registerSocketHandlers. Joins the user's
// private room (for friend pushes) and, on the online/offline TRANSITION only
// (0↔1 sockets), notifies their friends so the change shows up live.
export function trackPresence(io: Server, socket: Socket): void {
  const token = socket.handshake.auth?.token
  const userId = typeof token === 'string' ? verifyToken(token) : null
  if (!userId) return

  socket.join(userRoom(userId))

  const before = socketCounts.get(userId) ?? 0
  socketCounts.set(userId, before + 1)
  if (before === 0) notifyFriendsOfPresence(io, userId) // just came online

  socket.on(DISCONNECT, () => {
    const next = (socketCounts.get(userId) ?? 1) - 1
    if (next <= 0) {
      socketCounts.delete(userId)
      notifyFriendsOfPresence(io, userId) // went offline
    } else {
      socketCounts.set(userId, next)
    }
  })
}

export function isOnline(userId: string): boolean {
  return socketCounts.has(userId)
}
