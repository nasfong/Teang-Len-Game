import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// Password hashing on node:crypto scrypt (no native deps). Stored as
// `salt:hash` in hex; verification is a timing-safe compare.
const KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, KEYLEN)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = scryptSync(password, salt, KEYLEN)
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}
