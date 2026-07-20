import { ok, fail, type ServiceResult } from '../../types'
import { getUserById, searchUsers } from '../user/userStore'
import { listRooms } from '../../rooms/roomStore'
import { isOnline } from '../../sockets/presence'

// Friendships + friend requests (in-memory, like the rest of the app).
//
// A friendship is mutual and only exists once ACCEPTED. Getting there is a request
// flow: A sends a request to B (outgoing for A, incoming for B); B confirms it →
// they're friends, or declines it → the request is dropped; A can cancel their own
// pending request. If B happens to request A while A's request is still pending,
// the two "meet in the middle" and are linked immediately.
//
//   friends       userId → Set<friendId>            (accepted, mutual)
//   incomingReq   userId → Set<requesterId>          (requests waiting for userId)
//   outgoingReq   userId → Set<targetId>             (requests userId has sent)
//
// incomingReq/outgoingReq are kept as exact mirrors of each other.
const friends = new Map<string, Set<string>>()
const incomingReq = new Map<string, Set<string>>()
const outgoingReq = new Map<string, Set<string>>()

function edges(map: Map<string, Set<string>>, key: string): Set<string> {
  let set = map.get(key)
  if (!set) {
    set = new Set()
    map.set(key, set)
  }
  return set
}

export type FriendStatus = 'online' | 'playing' | 'offline'
export type Relation = 'friend' | 'incoming' | 'outgoing' | 'none'

// Derived live status: offline unless a socket is up; "playing" if seated in a
// room that's mid-match, otherwise "online".
function statusOf(userId: string): FriendStatus {
  if (!isOnline(userId)) return 'offline'
  const inGame = listRooms().some(
    (room) =>
      room.status === 'playing' &&
      room.players.some((p) => p.playerId === userId && p.status !== 'disconnected'),
  )
  return inGame ? 'playing' : 'online'
}

export interface UserView {
  id: string
  username: string
  displayName: string
  status: FriendStatus
}

export interface SearchResult {
  id: string
  username: string
  displayName: string
  relation: Relation
}

export interface FriendState {
  friends: UserView[]
  incoming: UserView[]
  outgoing: UserView[]
}

function toUserView(id: string): UserView | null {
  const user = getUserById(id)
  if (!user) return null
  return { id: user.id, username: user.username, displayName: user.displayName, status: statusOf(user.id) }
}

// Online first, then playing, then offline; alphabetical within each.
const STATUS_RANK: Record<FriendStatus, number> = { online: 0, playing: 1, offline: 2 }

function viewsOf(map: Map<string, Set<string>>, userId: string, sortByStatus = false): UserView[] {
  const list = [...edges(map, userId)].map(toUserView).filter((v): v is UserView => v !== null)
  return sortByStatus
    ? list.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.displayName.localeCompare(b.displayName))
    : list.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

// Just the ids — used to fan a presence change out to everyone who has this user
// as a friend (so their list flips them online/offline in real time).
export function getFriendIds(userId: string): string[] {
  return [...edges(friends, userId)]
}

export function areFriends(a: string, b: string): boolean {
  return edges(friends, a).has(b)
}

export function getFriendState(userId: string): FriendState {
  return {
    friends: viewsOf(friends, userId, true),
    incoming: viewsOf(incomingReq, userId),
    outgoing: viewsOf(outgoingReq, userId),
  }
}

function relationBetween(userId: string, otherId: string): Relation {
  if (edges(friends, userId).has(otherId)) return 'friend'
  if (edges(incomingReq, userId).has(otherId)) return 'incoming' // they asked me
  if (edges(outgoingReq, userId).has(otherId)) return 'outgoing' // I asked them
  return 'none'
}

// Search users to add — tags each hit with our relation so the UI can show the
// right control (Add / Requested / Confirm / Added).
export function searchToAdd(userId: string, query: string): SearchResult[] {
  return searchUsers(query, userId).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    relation: relationBetween(userId, u.id),
  }))
}

function link(a: string, b: string): void {
  edges(friends, a).add(b)
  edges(friends, b).add(a)
}

// Drop any pending request between the two, in either direction.
function clearRequests(a: string, b: string): void {
  edges(incomingReq, a).delete(b)
  edges(outgoingReq, a).delete(b)
  edges(incomingReq, b).delete(a)
  edges(outgoingReq, b).delete(a)
}

export function sendRequest(from: string, to: string): ServiceResult<FriendState> {
  if (from === to) return fail('You cannot add yourself.', 400)
  if (!getUserById(to)) return fail('That player no longer exists.', 404)
  if (edges(friends, from).has(to)) return fail('You are already friends.', 409)

  // They already asked us → the two requests meet, become friends immediately.
  if (edges(incomingReq, from).has(to)) {
    clearRequests(from, to)
    link(from, to)
    return ok(getFriendState(from))
  }

  // Idempotent: re-sending an existing request is a no-op, not an error.
  edges(outgoingReq, from).add(to)
  edges(incomingReq, to).add(from)
  return ok(getFriendState(from))
}

export function acceptRequest(userId: string, fromId: string): ServiceResult<FriendState> {
  if (!edges(incomingReq, userId).has(fromId)) return fail('No pending request from that player.', 404)
  clearRequests(userId, fromId)
  link(userId, fromId)
  return ok(getFriendState(userId))
}

// Decline an incoming request OR cancel an outgoing one — a pair only ever has a
// request in one direction, so a single "drop the pending link" covers both.
export function removePending(userId: string, otherId: string): ServiceResult<FriendState> {
  clearRequests(userId, otherId)
  return ok(getFriendState(userId))
}

export function removeFriend(userId: string, friendId: string): ServiceResult<FriendState> {
  edges(friends, userId).delete(friendId)
  edges(friends, friendId).delete(userId)
  return ok(getFriendState(userId))
}
