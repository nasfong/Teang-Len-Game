// The game-module contract.
//
// One folder under src/games/ per card game. Each exports a default object shaped
// like GameModule below, and the app shell renders ANY of them knowing nothing about
// cards, tricks, melds or betting.
//
// ── The rule that keeps this working ───────────────────────────────────────────
// KEEP THIS INTERFACE SMALL, and resist promoting a game's interesting functions
// into it. `classify`, `canBeat`, `suggestSelection` are Teang Len's business and
// stay private to src/games/teanglen/ — they are concepts specific to SHEDDING
// games. A rummy game (Phỏm/Tá Lả) has melds, a draw pile and a discard, and no
// notion of "beating"; a betting game has rounds and a pot. An interface wide enough
// to cover all three degenerates into `apply(state, action)`, which abstracts
// nothing and costs a layer.
//
// The shell only ever needs to know: how many seats, give me a board, autoplay this
// seat, and who won. That is the whole contract.
//
// ── The trust boundary this inherits ──────────────────────────────────────────
// The backend NEVER reads `state` — it is `unknown` at every layer there (see
// backend/src/types/index.ts) and the server just fans it out. So a game module is
// the ONLY authority on its own rules, and adding a game needs no backend game
// logic at all. The flip side: `state` must be plain JSON, because it is relayed
// over a socket. No class instances, no Map/Set, no functions, no undefined.

/**
 * @typedef {object} Seat
 * @property {string} playerId
 * @property {string} name
 */

/**
 * @typedef {object} GameMeta
 * @property {string}  id          stable slug, e.g. 'teanglen'. Persisted on the room
 *                                 and mirrored in the backend catalog — never rename.
 * @property {string}  name        display name for the lobby
 * @property {number}  minPlayers
 * @property {number}  maxPlayers
 * @property {number}  turnSeconds how long a seat has to act
 */

/**
 * @typedef {object} GameModule
 *
 * @property {GameMeta} meta
 *
 * @property {(seats: Seat[], opts?: object) => object} createMatch
 *   Deal a fresh match. Returns the initial `state` — plain JSON, relayed as-is.
 *   `opts` is game-specific; Teang Len takes `{ startingPlayerId }` for the
 *   server-owned winnerStartsNextGame rule.
 *
 * @property {React.ComponentType<{channel: object, room: object, waitingText?: string, waitingAction?: React.ReactNode}>} Board
 *   The whole in-room screen for this game — lobby seats AND play, since in this app
 *   they are the same screen. It owns its own layout, so a game that needs a discard
 *   pile or a betting strip just draws one; nothing above it has to make room.
 *   `waitingAction` is an optional node the room hangs UNDER the pre-game
 *   `waitingText` (the host's "Start now") — the Board decides where the waiting
 *   message lives, so it must place the button too rather than have the room guess.
 *
 * @property {(state: object, seat: number) => object|null} bot
 *   Pick a move for a seat and return the NEXT state, or null to stand pat. Drives
 *   AFK autoplay, which runs on a CLIENT (the server can't — it can't read `state`).
 *   Must be pure and deterministic given (state, seat).
 *
 * @property {(state: object) => {finished: boolean, ranked: Seat[]}} summarize
 *   Reduce a state to the result the shared ResultModal renders, so the shell can
 *   show standings without knowing how the game scores.
 */

export {}
