import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '../query/client'
import { router } from './router.jsx'
import GlobalErrorModal from './GlobalErrorModal.jsx'
import RoomInviteToast from './RoomInviteToast.jsx'
import LandscapeGate from './LandscapeGate.jsx'
import { useSession } from '../state/session'
import { connectSocket, disconnectSocket } from '../net/socket'
import { useFriendsRealtime } from '../query/friends'
import { useAutoGuest } from './useAutoGuest'

// Keep the shared socket connected for the WHOLE time the user is logged in — not
// just on the lobby/table screens that stream through it. Presence (who's online)
// is derived server-side from open sockets, so a user sitting on the Home page must
// still hold a socket or their friends would always see them offline. Logging out
// closes it, which correctly drops their presence.
function usePresenceSocket() {
  const token = useSession((s) => s.token)
  useEffect(() => {
    if (token) connectSocket()
    else disconnectSocket()
  }, [token])
}

// Subscribes to the real-time friend stream. Lives INSIDE QueryClientProvider (the
// hook writes to the query cache), renders nothing.
function FriendsRealtime() {
  useFriendsRealtime()
  return null
}

// Held while the testing build signs itself in — the same gradient the login and
// home screens fall back to, so the handover reads as one continuous screen.
function AutoGuestSplash() {
  return <div className="min-h-dvh w-full bg-linear-to-b from-[#2B7FC9] to-[#0F3358]" />
}

// AppRoot — the real app (providers + router). Kept in its own module so it lands
// in a SEPARATE bundle chunk: Preloader dynamically imports it, so the whole app
// (all routes, the game engine, motion, forms…) downloads AFTER the tiny entry
// chunk has already painted the progress screen.
export default function AppRoot() {
  usePresenceSocket()
  // Testing builds (VITE_AUTO_GUEST=true) sign a visitor in with a generated
  // throw-away account before the router mounts, so they land on Home instead of
  // the login screen. Off in production — this returns blocking:false instantly.
  const { blocking } = useAutoGuest()

  // Hold the router back for the one request, so /login never flashes first.
  if (blocking) return <AutoGuestSplash />

  return (
    <QueryClientProvider client={queryClient}>
      <FriendsRealtime />
      <RouterProvider router={router} />
      {/* One global connection/error popup over every screen. */}
      <GlobalErrorModal />
      {/* Slide-in room invitations from friends, over every screen. */}
      <RoomInviteToast />
      {/* Landscape-lock: a rotate prompt over everything when a phone is portrait. */}
      <LandscapeGate />
    </QueryClientProvider>
  )
}
