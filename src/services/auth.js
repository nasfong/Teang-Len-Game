import { apiFetch } from './http'

// Auth + wallet requests. `auth: false` on login/register so a bad-credentials 401
// isn't treated as a session expiry by the global guard in http.js.

export function login({ username, password }) {
  return apiFetch('/api/auth/login', { method: 'POST', auth: false, body: { username, password } })
}

export function register({ username, password }) {
  return apiFetch('/api/auth/register', { method: 'POST', auth: false, body: { username, password } })
}

/** @param mode {'login' | 'register'} — AuthForm reports which one the user picked. */
export function authenticate({ mode, username, password }) {
  return mode === 'register' ? register({ username, password }) : login({ username, password })
}

export function getWallet() {
  return apiFetch('/api/wallet')
}
