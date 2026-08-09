// Sticky UI preferences — the small choices a screen should remember between
// visits (the Create Room modal's "Play with Bots", and whatever follows).
//
// Kept OUT of the components themselves: everything under components/ has to stay
// portable, so a form takes its defaults as props and the app decides where they
// come from. Server data belongs in api/, screen state in the component; this is
// only for the leftovers that outlive a screen but aren't worth a store.
//
// One JSON blob under one key, so adding a preference costs nothing. localStorage
// can throw (Safari private mode, quota) and a corrupt blob must never break a
// screen — every path falls back to the caller's default, same as soloGame.js.
const KEY = 'teanglen-prefs'

function readAll() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    // A non-object (someone stored a string, or an old format) is unusable — drop it
    // rather than letting `parsed[name]` throw or return nonsense.
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Read one preference, or `fallback` if it was never set / storage is unavailable. */
export function getPref(name, fallback = null) {
  const value = readAll()[name]
  return value === undefined ? fallback : value
}

/** Remember one preference. Silently a no-op if storage is unavailable. */
export function setPref(name, value) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [name]: value }))
  } catch {
    /* private mode / quota — the app still works, it just won't remember. */
  }
}
