// Game rule variations.
//
// The backend NEVER computes game logic — `gameState` is opaque at every layer
// (see types/index.ts) and the clients' engine owns the rules. But the backend DOES
// own the rule CONFIGURATION: it ships these flags to every client in the room
// snapshot, so whoever deals the next match applies the same variation and no
// client can drift. That's what keeps frontend and backend in sync without the
// server ever reading a card.
//
// Add future variations here (deck size, bomb toggles, scoring) and surface them
// the same way, rather than hard-coding them in the client engine.

export interface GameRules {
  /**
   * After the FIRST match of a room, the previous winner (1st place) takes the
   * opening turn instead of whoever holds 3♠.
   *
   * The 3♠ rule always opens a room's first match — there is no previous winner
   * yet — and is also the fallback if the last winner has since left the room.
   */
  winnerStartsNextGame: boolean
}

export const defaultRules: GameRules = {
  winnerStartsNextGame: true,
}
