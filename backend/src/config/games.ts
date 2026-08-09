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
  code: string
  name: string
  minPlayers: number
  maxPlayers: number
  turnDurationMs: number
  payout: PayoutModel
  // Instant mid-hand penalties, as multiples of the room's bet, keyed by the game's
  // own event name. Teang Len's chặt: cutting a 2 with a bomb is paid on the spot by
  // the owner of that 2, not folded into the placement payout. Absent → the game has
  // no mid-hand transfers and any claim of one is ignored.
  bombPenalties?: Record<string, number>
  rules: GameRules
}

export const games: Record<string, GameDefinition> = {
  teanglen: {
    code: 'teanglen',
    name: 'Teang Len',
    minPlayers: 2,
    maxPlayers: 4,
    turnDurationMs: 15_000,
    payout: 'placement',
    // §5 bomb cuts. Four consecutive pairs kills a PAIR of 2s, so it prices double.
    // The client mirrors this for display only (src/games/teanglen/match.js) — these
    // numbers are the authority.
    bombPenalties: {
      quad: 1,
      flush_straight_5: 1,
      four_pairs: 2,
    },
    rules: defaultRules,
  },
  kanteal: {
    code: 'kanteal',
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

export const DEFAULT_GAME_CODE = 'teanglen'

export const gameCodes = Object.keys(games)

/**
 * Look up a game, falling back to the default. An unknown code must not be able to
 * strand a room with no seat limits, so this never returns undefined — seat counts
 * and the turn timer are enforced from whatever it returns.
 */
export function getGame(code: string | undefined | null): GameDefinition {
  return (code && games[code]) || games[DEFAULT_GAME_CODE]
}
