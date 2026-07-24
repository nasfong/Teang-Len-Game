import { io } from 'socket.io-client'
import { API_URL } from './config'
import { useSession } from '../state/session'
import { useAppError } from '../state/appError'

// One shared Socket.IO connection for the whole app — the lobby stream today, the
// game table next. Lazy + manual: nothing connects until a screen calls connect(),
// and it stays up across route changes so we don't thrash the handshake.
//
// The token rides along in the auth handshake (re-read on every (re)connect via the
// function form) for when the server starts authenticating sockets; the lobby list
// itself is public, so a missing token is fine.
let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: useSession.getState().token ?? null }),
    })

    // Surface a dropped realtime connection as the global modal (Socket.IO keeps
    // auto-retrying underneath) — but only if it STAYS down. A brief blip that
    // reconnects within the grace never flashes the modal: we arm a timer on
    // disconnect and cancel it the moment we're back. A clean (re)connect also
    // clears any modal already showing.
    let lostTimer = null
    const clearLostTimer = () => {
      if (lostTimer) {
        clearTimeout(lostTimer)
        lostTimer = null
      }
    }
    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return // we disconnected on purpose
      clearLostTimer()
      lostTimer = setTimeout(() => {
        lostTimer = null
        useAppError.getState().showError({ title: 'Connection lost', message: 'Trying to reconnect…' })
      }, 2000)
    })
    socket.on('connect', () => {
      clearLostTimer()
      useAppError.getState().clearError()
    })
  }
  return socket
}

// Ensure the shared socket is connected, returning it.
export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

// Close the shared socket on purpose (e.g. logout). The 'io client disconnect'
// reason tells our disconnect handler NOT to raise the "connection lost" modal.
export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
