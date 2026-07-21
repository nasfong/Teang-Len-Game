import { apiFetch, ApiError } from './api'
import { API_URL } from './config'
import { useSession } from '../state/session'

// Auto-guest sign-in — TESTING ENVIRONMENTS ONLY.
//
// When VITE_AUTO_GUEST is on, a visitor who arrives with no session gets a throw-
// away account generated + registered for them, so the testing deployment opens
// straight on Home instead of the login screen. Production builds leave the flag
// unset and nothing here ever runs: the normal login flow is untouched.
//
// The generated credentials are kept in localStorage so a refresh reuses the SAME
// account (coins, friends and room history survive) rather than piling up a new
// user per page load. They're stored per API origin, so pointing the build at a
// different backend starts a fresh account instead of failing to log in to one
// that server has never seen.
export const AUTO_GUEST_ENABLED = import.meta.env.VITE_AUTO_GUEST === 'true'

// Prefix shown in the UI, so a test account is obvious at a glance. Kept inside
// the backend's username rule: /^[a-zA-Z0-9_]{3,20}$/.
const USERNAME_PREFIX = import.meta.env.VITE_AUTO_GUEST_PREFIX || 'test'
const STORAGE_KEY = 'teanglen-auto-guest'

function randomToken(length) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

/** A fresh credential pair that satisfies the server's register schema. */
function generateCredentials() {
  const prefix = USERNAME_PREFIX.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 10) || 'test'
  return {
    username: `${prefix}_${randomToken(8)}`, // ≤ 19 chars
    password: randomToken(16),
    apiUrl: API_URL,
  }
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (!saved?.username || !saved?.password) return null
    // Credentials belong to the backend they were created on.
    if (saved.apiUrl !== API_URL) return null
    return saved
  } catch {
    return null
  }
}

function writeStored(creds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
  } catch {
    // Private-mode / storage-full: the account still works for this page load.
  }
}

function clearStored() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function post(path, body) {
  return apiFetch(path, { method: 'POST', auth: false, body })
}

/**
 * Sign in as the stored throw-away account, creating one if needed.
 * Resolves to the session ({ token, user, wallet }), or throws on failure.
 */
async function obtainSession() {
  const saved = readStored()

  if (saved) {
    const { username, password } = saved
    try {
      return await post('/api/auth/login', { username, password })
    } catch (err) {
      // A 401 means that server no longer knows this account (in-memory store
      // restarted, database reset). Anything else — network, 5xx — is a real
      // outage and must not silently burn the saved account.
      if (!(err instanceof ApiError) || err.status !== 401) throw err
      clearStored()
    }
  }

  const creds = generateCredentials()
  const { username, password } = creds
  const session = await post('/api/auth/register', { username, password })
  writeStored(creds)
  return session
}

let inFlight = null

/**
 * Ensure a session exists when auto-guest is enabled. No-op when the flag is off
 * or the visitor is already signed in — an existing login is never replaced.
 * Concurrent calls share one request. Returns true once a session is in place.
 */
export async function ensureAutoGuestSession() {
  if (!AUTO_GUEST_ENABLED) return false
  if (useSession.getState().token) return true

  inFlight ??= obtainSession()
    .then((session) => {
      useSession.getState().setSession(session)
      return true
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}
