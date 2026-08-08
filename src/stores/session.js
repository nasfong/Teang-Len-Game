import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Session store (Zustand) — the GLOBAL client state shared across the app: the
// auth token, the signed-in user, and their wallet. This is the "profile / global
// data" layer. Server *fetches* (wallet refresh, room lists) live in TanStack
// Query; the durable identity lives here.
//
// token + user are PERSISTED to localStorage so a refresh keeps you signed in
// (and lets the Table page rebuild via a refetch). The wallet is NOT persisted —
// it's server state, refetched by useWallet() so a stale balance never lingers.
export const useSession = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      wallet: null,
      // True only after the user pressed Log out. Testing builds read it so the
      // auto-guest sign-in doesn't instantly undo an intentional sign-out —
      // every OTHER way the session empties (an expired token 401ing) is a
      // failure we do want re-signed-in. Not persisted: reopening starts clean.
      manualSignOut: false,

      /** Set from a login/register response ({ token, user, wallet }). */
      setSession: ({ token, user, wallet }) => set({ token, user, wallet, manualSignOut: false }),
      setWallet: (wallet) => set({ wallet }),
      /** Session lost, not chosen — expiry, a 401, a server that forgot us. */
      clear: () => set({ token: null, user: null, wallet: null }),
      /** The Log out button: same teardown, but deliberate. */
      logout: () => set({ token: null, user: null, wallet: null, manualSignOut: true }),
    }),
    {
      name: 'teanglen-session',
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
)

// Selectors — keep components subscribed to just what they read.
export const selectIsAuthed = (s) => Boolean(s.token)
export const selectUser = (s) => s.user
export const selectCoin = (s) => s.wallet?.coin ?? 0
export const selectManualSignOut = (s) => s.manualSignOut
