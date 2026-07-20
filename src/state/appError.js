import { create } from 'zustand'

// Global app-error surface — connection loss and unexpected server faults, shown as
// one glass modal at the app root. Screens keep handling their OWN business errors
// inline (bad login, cooldown, room full…); only the "can't reach / server broke"
// class bubbles up here, since those often come from background work with no inline
// place to show them.
export const useAppError = create((set) => ({
  error: null, // { title, message } | null — one at a time
  showError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}))
