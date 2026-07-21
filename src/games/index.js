// The game registry — id → module. Add a game here and the lobby, the room screen
// and the AFK bot all pick it up; nothing else in the app needs to change.
//
// LOADERS, NOT MODULES. Each entry is a function returning a dynamic import, so
// Rollup gives every game its own chunk and a phone downloads only the one being
// played. This matters more than it looks: the main bundle is already past Vite's
// 500 kB warning, and six eagerly-imported games (each with an engine, a bot and a
// board) would land on the one device this game is actually played on.
//
// `catalogue` is the cheap part — id/name/seat-counts for the lobby — and is
// deliberately kept OUT of the lazy chunks, so listing the games doesn't download
// them. Keep it in step with each module's own `meta` (and with the backend catalog
// at backend/src/config/games.ts, which is the authority for anything a client
// could forge, like seat counts).

const LOADERS = {
  teanglen: () => import('./teanglen/index.js'),
  kanteal: () => import('./kanteal/index.js'),
}

export const catalogue = [
  { id: 'teanglen', name: 'Teang Len', minPlayers: 2, maxPlayers: 4 },
  { id: 'kanteal', name: 'Kanteal', minPlayers: 2, maxPlayers: 8 },
]

export const DEFAULT_GAME_ID = 'teanglen'

export const isGameId = (id) => Object.hasOwn(LOADERS, id)

/**
 * Load one game module. Unknown ids fall back to the default rather than throwing —
 * a room row carrying a game this build doesn't ship (an older client, a game pulled
 * from the catalog) should still open, not white-screen the table.
 * @returns {Promise<import('./contract.js').GameModule>}
 */
export async function loadGame(id) {
  const load = LOADERS[id] ?? LOADERS[DEFAULT_GAME_ID]
  return (await load()).default
}
