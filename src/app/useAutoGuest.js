import { useEffect, useRef, useState } from 'react'
import { AUTO_GUEST_ENABLED, ensureAutoGuestSession } from '../net/autoGuest'
import { useSession } from '../state/session'

// Runs the auto-guest sign-in ONCE per page load on testing builds, and tells
// AppRoot whether to hold the router back while it's in flight (so the login
// screen never flashes before we land on Home).
//
// Attempted once only: after an explicit logout the session is empty again, and
// re-signing-in there would make the logout button impossible to use. A reload
// gets you a new auto sign-in — into the same stored account.
export function useAutoGuest() {
  const authed = Boolean(useSession((s) => s.token))
  // Only ever blocks when the flag is on AND we arrived with no session.
  const [blocking, setBlocking] = useState(() => AUTO_GUEST_ENABLED && !useSession.getState().token)
  const attempted = useRef(false)

  useEffect(() => {
    if (!blocking || attempted.current) return
    attempted.current = true

    let cancelled = false
    ensureAutoGuestSession()
      .catch(() => {
        // Backend down or registration rejected — fall through to the normal
        // login screen rather than trapping the visitor on a splash.
      })
      .finally(() => {
        if (!cancelled) setBlocking(false)
      })

    return () => {
      cancelled = true
    }
  }, [blocking])

  return { blocking: blocking && !authed }
}
