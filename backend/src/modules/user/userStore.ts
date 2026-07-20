import { randomUUID } from 'node:crypto'
import type { PublicUser, User } from '../../types'

// In-memory user store (spec §3.2). Unique username enforced on create.
const users = new Map<string, User>()
const byUsername = new Map<string, string>() // lowercased username → userId

export function createUser(input: { username: string; displayName: string; passwordHash: string }): User | null {
  const key = input.username.toLowerCase()
  if (byUsername.has(key)) return null // username taken
  const user: User = {
    id: randomUUID(),
    username: input.username,
    displayName: input.displayName,
    passwordHash: input.passwordHash,
    createdAt: Date.now(),
  }
  users.set(user.id, user)
  byUsername.set(key, user.id)
  return user
}

export function getUserById(id: string): User | undefined {
  return users.get(id)
}

export function getUserByUsername(username: string): User | undefined {
  const id = byUsername.get(username.toLowerCase())
  return id ? users.get(id) : undefined
}

// Case-insensitive substring search over username + displayName, excluding one
// user (the caller — you don't befriend yourself). Capped so a broad query can't
// return the whole table.
export function searchUsers(query: string, excludeId: string, limit = 10): User[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: User[] = []
  for (const user of users.values()) {
    if (user.id === excludeId) continue
    if (user.username.toLowerCase().includes(q) || user.displayName.toLowerCase().includes(q)) {
      out.push(user)
      if (out.length >= limit) break
    }
  }
  return out
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt }
}
