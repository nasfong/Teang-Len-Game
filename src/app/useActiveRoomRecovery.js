import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../net/api'
import { useSession, selectIsAuthed } from '../state/session'

// Cold-boot recovery — "am I still in a live room?"
//
// Reconnect state-restore (seat, hand, turn clock) already works once the client is
// sitting on /table/:roomId: useRoom + useRoomChannel rebuild everything from the
// room snapshot. The only thing missing is getting a returning player BACK to that
// URL when the app cold-boots to Home instead — a PWA relaunch, an OS app-kill, or
// a browser refresh that lands on `/`. Nothing on the client maps the durable
// playerId to a room, so we ask the server.
//
// This runs ONCE per app launch (a module-level latch, not per-render), so ordinary
// navigation — tapping Home, leaving a table on purpose — never yanks the player
// back. A refresh ON the table URL is already handled by TableContainer, so we skip
// when we're on that room's route.
let recovered = false

export function useActiveRoomRecovery() {
  const authed = useSession(selectIsAuthed)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Signed out (logout, expiry) → re-arm so the NEXT sign-in on this same page
    // load recovers its own active room.
    if (!authed) {
      recovered = false
      return
    }
    if (recovered) return
    // Latch immediately so a re-render (or StrictMode's double-invoke) can't fire a
    // second lookup; the request below is a best-effort one-shot.
    recovered = true
    let cancelled = false

    apiFetch('/api/rooms/active')
      .then(({ room }) => {
        if (cancelled || !room) return
        const target = `/table/${room.roomId}`
        // Already there (refresh on the table URL) — TableContainer owns it.
        if (location.pathname === target) return
        navigate(target, { replace: true })
      })
      .catch(() => {
        // Recovery is best-effort: a failed lookup (offline, server down) just
        // leaves the player where they landed. Re-arm so a later mount can retry.
        recovered = false
      })

    return () => {
      cancelled = true
    }
    // Intentionally launch-scoped: the latch, not the deps, guards re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])
}
