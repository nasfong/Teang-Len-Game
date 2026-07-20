import { create } from 'zustand'

// Incoming room invites waiting for the user to confirm/cancel. Fed by the socket
// `room:invite` listener, drained by the slide-in cards. Keyed by roomId+sender so
// a re-sent invite for the same room replaces rather than stacks.
export const useInvites = create((set) => ({
  invites: [],
  addInvite: (invite) =>
    set((state) => {
      const key = `${invite.roomId}:${invite.from.id}`
      const rest = state.invites.filter((i) => i.key !== key)
      return { invites: [...rest, { ...invite, key }] }
    }),
  dismiss: (key) => set((state) => ({ invites: state.invites.filter((i) => i.key !== key) })),
}))
