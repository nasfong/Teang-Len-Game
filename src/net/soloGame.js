// Client-only "solo vs bots" game, persisted to localStorage so a practice game
// survives a refresh — there is NO server room behind it. Mirrors autoGuest.js's safe
// wrapper: localStorage can throw (Safari private mode, quota), and a failed persist
// must never break the game — it just means it won't resume.
const KEY = 'teanglen-solo-game'

export function readSolo() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeSolo(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* private mode / quota — the game still runs, it just won't resume. */
  }
}

export function clearSolo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
