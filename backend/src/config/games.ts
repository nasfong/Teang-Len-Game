import { defaultRules, type GameRules } from './rules'

// The game catalog — one entry per card game the server will host a room for.
//
// The backend still NEVER computes game logic: `gameState` stays opaque and the
// clients' engine owns every rule (see types/index.ts). What lives here is the
// small set of facts the SERVER must own because it enforces them and a client
// could otherwise forge:
//
//   • seat counts — they gate room creation and seat assignment. `maxPlayers` used
//     to be a client-supplied number bounded only by `min(2).max(4)`, so a payload
//     could open a 4-seat room for a game that only works with 2.
//   • turn duration — the server runs the turn timer that actually evicts a seat.
//   • rule variations — shipped to every client in the room snapshot so whoever
//     deals the next match applies the same variation and no client can drift.
//
// Mirrored on the client at src/games/index.js. THIS file is the authority; the
// client copy exists only so the lobby can list games without downloading them.
//
// Adding a game: add an entry here and a folder under src/games/. No socket
// handler, validator or service needs to change.

// How a match's pot is settled at game end. SERVER-OWNED (a client asserts who won,
// never how much money moves), keyed per game because the games score differently:
//
//   'placement'        — every finisher is ranked 1..n and paid by placement via
//                        PAYOUT_MULTIPLIERS (Teang Len: 1st wins most, last loses a
//                        full bet). Zero-sum across the table.
//   'winner-take-all'  — exactly one winner; every other participant loses ONE bet
//                        and the winner collects them all (Kanteal, §4). Also
//                        zero-sum, and scales to any seat count (Kanteal seats 2–8),
//                        which placement multipliers don't.
export type PayoutModel = 'placement' | 'winner-take-all'

export interface GameDefinition {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  turnDurationMs: number
  payout: PayoutModel
  rules: GameRules
}

export const games: Record<string, GameDefinition> = {
  teanglen: {
    id: 'teanglen',
    name: 'Teang Len',
    minPlayers: 2,
    maxPlayers: 4,
    turnDurationMs: 15_000,
    payout: 'placement',
    rules: defaultRules,
  },
  kanteal: {
    id: 'kanteal',
    name: 'Kanteal',
    minPlayers: 2,
    maxPlayers: 8,
    turnDurationMs: 20_000,
    // §4 — Kanteal crowns exactly one winner, so the pot is winner-take-all: each
    // other player at the table pays one bet and the winner sweeps them.
    payout: 'winner-take-all',
    // Kanteal has no next-match opener rule of its own: each cycle's winner opens
    // the next cycle, and a new match just starts from seat 0.
    rules: { winnerStartsNextGame: false },
  },
}

export const DEFAULT_GAME_ID = 'teanglen'

export const gameIds = Object.keys(games)

/**
 * Look up a game, falling back to the default. Rooms created before `gameId`
 * existed carry none, and an unknown id must not be able to strand a room with no
 * seat limits — so this never returns undefined.
 */
export function getGame(id: string | undefined | null): GameDefinition {
  return (id && games[id]) || games[DEFAULT_GAME_ID]
}
