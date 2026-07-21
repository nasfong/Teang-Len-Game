import { useEffect, useState } from 'react'
import { loadGame } from './index.js'

// Resolve a room's `gameId` to its module, loading the chunk on demand.
//
// Returns null until the chunk lands, so every caller must handle "no game yet" —
// that's the price of code-splitting the games, and it costs one loading branch on
// the single screen that needs it. `id` may legitimately be undefined for a beat
// while the room itself is still being fetched; that just holds at null.
export function useGame(id) {
  const [entry, setEntry] = useState(null)

  useEffect(() => {
    if (!id) return
    let live = true
    // Guarded by `live`: switching rooms (or unmounting) mid-load must not push a
    // stale module into state and render the wrong game's board.
    loadGame(id).then((mod) => live && setEntry({ id, mod }))
    return () => {
      live = false
    }
  }, [id])

  // Keyed by the id that was REQUESTED, not by the loaded module's own id — those
  // differ when loadGame falls back for an unknown game, and comparing meta.id would
  // reject the fallback and hang on null forever.
  return entry?.id === id ? entry.mod : null
}
