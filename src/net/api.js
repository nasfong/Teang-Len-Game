import { API_URL } from './config'
import { useSession } from '../state/session'

// Thin fetch wrapper over the backend's `{ ok, data | error }` envelope. Attaches
// the Bearer token from the session store, unwraps `data` on success, and throws
// an ApiError (with the HTTP status) on failure — so callers/react-query see a
// real Error with a readable message.
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const { token } = useSession.getState()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // Network-level failure (server down, CORS, offline).
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    // non-JSON response
  }

  if (!res.ok || !json?.ok) {
    // Global auth guard: a 401 on an authenticated request means the token is gone
    // or expired — drop the session. The route guards (RequireAuth) subscribe to
    // the session, so clearing it bounces the user to /login automatically. Skipped
    // for auth:false calls (login/register) so a bad-credentials 401 isn't treated
    // as a session expiry.
    if (res.status === 401 && auth) {
      useSession.getState().clear()
    }
    throw new ApiError(json?.error || `Request failed (${res.status})`, res.status)
  }
  return json.data
}
