import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../../config'

// HS256 JWT, hand-rolled on node:crypto (spec §3.1). Kept dependency-free so the
// signature check is an explicit timing-safe compare, and `exp` is enforced.

interface JwtPayload {
  sub: string // userId
  iat: number
  exp: number
}

const b64url = (buf: Buffer): string => buf.toString('base64url')

function sign(part: object): string {
  return b64url(Buffer.from(JSON.stringify(part)))
}

function hmac(data: string): Buffer {
  return createHmac('sha256', config.authSecret).update(data).digest()
}

export function signToken(userId: string): string {
  const header = sign({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const payload = sign({ sub: userId, iat: now, exp: now + config.jwtTtlSeconds })
  const data = `${header}.${payload}`
  const signature = b64url(hmac(data))
  return `${data}.${signature}`
}

/** Verify signature (timing-safe) and expiry. Returns the userId or null. */
export function verifyToken(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  const expected = b64url(hmac(`${header}.${payload}`))

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as JwtPayload
    if (typeof decoded.sub !== 'string') return null
    if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) return null
    return decoded.sub
  } catch {
    return null
  }
}
