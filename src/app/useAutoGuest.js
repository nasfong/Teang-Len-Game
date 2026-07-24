import { useEffect, useRef, useState } from 'react'
import { AUTO_GUEST_ENABLED, ensureAutoGuestSession } from '../net/autoGuest'
import { useSession, selectIsAuthed, selectManualSignOut } from '../state/session'

// Drives the auto-guest sign-in on testing builds, and tells AppRoot whether to
// hold the router back while it's in flight (so the login screen never flashes).
//
// Reacts to the session going away, NOT just to page load. An installed PWA is
// launched once and never reloaded, so a boot-only sign-in stranded the user on
// /login the moment their session was lost mid-run — an expired token, or the
// backend's in-memory user store restarting and 401ing them out — with no reload
// button in standalone mode to trigger a retry.
//
// The one sign-out we don't reverse is a deliberate one: `manualSignOut` (set by
// the Log out button) keeps the login screen reachable on testing builds. Signing
// in by hand clears it.
export function useAutoGuest() {
  const authed = useSession(selectIsAuthed)
  const manualSignOut = useSession(selectManualSignOut)
  // Only ever blocks when the flag is on AND we arrived with no session.
  const [blocking, setBlocking] = useState(() => AUTO_GUEST_ENABLED && !useSession.getState().token)
  // Guards against a failed attempt re-firing forever: one try per signed-out
  // stretch, rearmed once a session exists again.
  const attempted = useRef(false)

  useEffect(() => {
    if (authed) {
      attempted.current = false
      return
    }
    if (!AUTO_GUEST_ENABLED || manualSignOut || attempted.current) return
    attempted.current = true
    setBlocking(true)

    // Unblocking is deliberately NOT guarded by a cleanup flag. StrictMode mounts
    // this twice: the first cleanup would set that flag, and `attempted` (a ref,
    // which survives the remount) stops the second pass from starting a fresh
    // request — so the only in-flight promise resolves with its unblock cancelled
    // and the splash stays up FOREVER. That was invisible while the backend was
    // up, because a successful sign-in sets a token and `!authed` clears the block
    // on its own; with the API unreachable there's no token, and the app hung on a
    // blank gradient — including routes like /component that need no backend.
    // A setState on an unmounted component is a harmless no-op in React 19.
    ensureAutoGuestSession()
      .catch(() => {
        // Backend down or registration rejected — fall through to the normal
        // login screen rather than trapping the visitor on a splash.
      })
      .finally(() => setBlocking(false))
  }, [authed, manualSignOut])

  return { blocking: blocking && !authed }
}
