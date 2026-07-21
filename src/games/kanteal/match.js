import { canBeat, deal, FACE_UP_AT } from './engine.js'

// Kanteal turn flow — the PURE, serializable state machine. Every function takes a
// full state and returns the next one, so any client can compute its own move and
// relay the result (the backend never reads this; see ../contract.js).
//
// Everything here is plain JSON — no Map/Set, no class instances — because the
// whole state goes over a socket.
//
// ── The shape of a game ───────────────────────────────────────────────────────
// Play is a sequence of CYCLES (§3). One player opens with any card; every other
// player still in the game then acts exactly once, clockwise. The cycle ends when
// everyone has acted, and the last player who successfully BEAT during it wins the
// cycle and opens the next. The winner of the FINAL cycle wins the game (§4) —
// emptying your hand first wins nothing.
//
// Two rules make this harder than it looks and are the source of most of the code
// below:
//   §5 at ≤2 cards you may no longer pass, and a card that cannot beat is played
//      face-up anyway — it leaves the hand but takes nothing.
//   §6 reaching ≤2 cards having never opened or beaten cuts you from the game.

// PLACEHOLDER (§3) — if a whole cycle passes with NO successful beat, the opener is
// treated as the cycle winner. The spec flags this as invented to fill a gap, and it
// can decide the game, since the game's winner is a cycle winner. Kept as a named
// flag so it is easy to find and re-check against real play.
export const DEFAULT_RULES = {
  openerWinsUncontestedCycle: true,
  // §6's two named tuning knobs, made settable rather than hard-coded, because the
  // spec's balance note says the 2-card cut "frequently cuts half the table" at 4
  // players and calls these out as the dials to turn. See ./analyse.mjs for what
  // each one actually does to the elimination rate.
  faceUpAt: FACE_UP_AT, // hand size at which passing stops and the cut is measured
  openingCountsAsBeat: true, // does opening a cycle prove you're still in the game?

  // §4 has TWO readings of who wins, and they disagree on roughly a quarter of
  // 4-player games (measured — see ./analyse.mjs):
  //   false — the winner of the FINAL CYCLE, i.e. its opener when nobody beat in it.
  //           §4A's literal wording. This is the default, and what shipped.
  //   true  — the last player to beat ANYWHERE in the game. §4's headline wording:
  //           "the player who makes the latest successful beat is the winner."
  // They differ when the final cycle is uncontested AND its opener isn't the last
  // player to have actually beaten — e.g. the cycle winner ran out of cards, so the
  // next seat opened, and then nobody could answer.
  winnerIsLastBeatOverall: false,
}

// Rules travel INSIDE the state (it's relayed to every client), so a match always
// resolves against the variation it was dealt with — a client can't drift by having
// been built with a different default.
const faceUpAt = (state) => state.rules?.faceUpAt ?? FACE_UP_AT

// A seat that can still take a turn. Note the two ways to be out are DIFFERENT:
// eliminated (§6) is out for good and can never win, whereas simply running out of
// cards is neutral — that player still wins if their beat was the last one standing.
const canAct = (state, seat) => !state.eliminated[seat] && state.hands[seat].length > 0
const alive = (state) => state.seats.map((_, i) => i).filter((i) => !state.eliminated[i])
const holdingCards = (state) => state.seats.map((_, i) => i).filter((i) => canAct(state, i))

// Next seat clockwise from `from` satisfying `ok`, or null. Walks the ring by seat
// index, which IS clockwise order (seats are stored in table order).
function nextWhere(state, from, ok) {
  for (let s = 1; s <= state.seats.length; s++) {
    const q = (from + s) % state.seats.length
    if (ok(q)) return q
  }
  return null
}

/**
 * Deal a fresh game. `seats` = [{ playerId, name }] in seat order.
 * `startingPlayerId` opens the first cycle (the room's winnerStartsNextGame rule);
 * omit it and seat 0 opens.
 */
export function createMatch(seats, { startingPlayerId = null, rules = DEFAULT_RULES } = {}) {
  const { hands } = deal(seats.length)
  const prev = startingPlayerId ? seats.findIndex((s) => s.playerId === startingPlayerId) : -1
  const opener = prev >= 0 ? prev : 0
  return {
    seats,
    hands, // hands[seat] = card[]
    rules,
    table: null, // the card on the table; null means a cycle is being opened
    opener, // who opened this cycle
    leader: null, // last seat to successfully BEAT this cycle (opening is not a beat)
    lastBeater: null, // last seat to beat in the WHOLE game — survives the cycle reset
    currentPlayer: opener,
    acted: seats.map(() => false), // who has taken their one turn this cycle
    eliminated: seats.map(() => false), // §6 — cut from the game, cards never revealed
    hasBeaten: seats.map(() => false), // §6 — has ever opened OR beaten, i.e. is safe
    discards: seats.map(() => 0), // §3 — face-down passes. A COUNT ONLY, never the cards
    reveals: [], // §5 non-beating cards played face-up this cycle (display)
    challenge: null, // §7 { seat, card } — display only, never affects legality
    cycle: 0,
    phase: 'playing', // 'playing' | 'over'
    winner: null, // seat index once phase is 'over'
    turnKey: 0, // bumps every turn — the seat-ring timer keys on it
  }
}

// ── Cycle resolution ──────────────────────────────────────────────────────────

// End the current cycle and either finish the game or open the next one.
function endCycle(state) {
  // §3.4 — the cycle winner is the last player who beat. With no beats at all, the
  // opener takes it (the PLACEHOLDER above).
  const cycleWinner = state.leader ?? (state.rules.openerWinsUncontestedCycle ? state.opener : null)
  // Who takes the GAME if this turns out to be the last cycle. Falls back to the
  // cycle winner when nobody has ever beaten (a game of pure opens).
  const gameWinner = state.rules?.winnerIsLastBeatOverall ? (state.lastBeater ?? cycleWinner) : cycleWinner

  // §4A — no cards left anywhere, so no further cycle can begin. The winner of this
  // last cycle wins the game: "the player who makes the latest successful beat".
  if (holdingCards(state).length === 0) {
    return { ...state, phase: 'over', winner: gameWinner, turnKey: state.turnKey + 1 }
  }

  // The cycle winner opens next (§3.4) — unless they have no cards left to open
  // with, in which case the next seat clockwise who does opens instead. The spec
  // doesn't cover this; it follows from "the opener must play a real card" (§3).
  const opener = canAct(state, cycleWinner) ? cycleWinner : nextWhere(state, cycleWinner, (q) => canAct(state, q))
  if (opener === null) return { ...state, phase: 'over', winner: gameWinner, turnKey: state.turnKey + 1 }

  return {
    ...state,
    table: null,
    opener,
    leader: null,
    currentPlayer: opener,
    acted: state.seats.map(() => false),
    reveals: [], // §7 — the challenge display resets with the cycle
    challenge: null,
    cycle: state.cycle + 1,
    turnKey: state.turnKey + 1,
  }
}

// Everything after an action: check for a lone survivor, then either pass the turn
// on or close the cycle. One place, so the flow can't diverge.
function settle(state, actor) {
  const acted = [...state.acted]
  acted[actor] = true
  const next = { ...state, acted }

  // §4B — elimination has left one player standing; they win immediately, cards or
  // not. Checked before anything else, since it ends the game outright.
  const survivors = alive(next)
  if (survivors.length === 1) {
    return { ...next, phase: 'over', winner: survivors[0], turnKey: next.turnKey + 1 }
  }

  // §3.2 — everyone still in the game acts exactly once. This asks who has NOT
  // acted rather than counting turns, because elimination can shrink the field
  // midcycle and a fixed count would run the cycle long or cut it short.
  const up = nextWhere(next, actor, (q) => canAct(next, q) && !next.acted[q])
  if (up === null) return endCycle(next)
  return { ...next, currentPlayer: up, turnKey: next.turnKey + 1 }
}

// ── Actions ───────────────────────────────────────────────────────────────────

const turnError = (state, seat) => {
  if (state.phase !== 'playing') return 'Game is not in progress'
  if (state.currentPlayer !== seat) return 'Not your turn'
  if (state.eliminated[seat]) return "You've been cut from this game"
  return null
}

/**
 * Play one card face-up. Covers all three cases the rules allow:
 *   opening a cycle (§3) — any card is legal, and it counts as a beat for §6
 *   beating (§2)         — same suit, strictly higher rank
 *   revealing (§5)       — at ≤2 cards a card that CANNOT beat is played anyway:
 *                          it leaves the hand, but takes neither the table nor the lead
 */
export function applyPlay(state, seat, card) {
  const err = turnError(state, seat)
  if (err) return { error: err }
  const hand = state.hands[seat]
  const held = hand.find((c) => c.id === card.id)
  if (!held) return { error: 'That card is not in your hand' }

  const isOpening = state.table === null
  const beats = !isOpening && canBeat(held, state.table)

  // A non-beating card is only playable once hidden passing has stopped (§5).
  // Above that, the play is simply illegal — pass instead.
  if (!isOpening && !beats && hand.length > faceUpAt(state)) {
    return { error: `That doesn't beat the ${state.table.rank}${SUIT_MARK[state.table.suit]} — pass instead.` }
  }

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== held.id) : h))
  const next = { ...state, hands }

  if (isOpening) {
    // §3 — opening beats nothing, so it does NOT set `leader`; an uncontested cycle
    // falls back to the opener at endCycle. But §6 counts it as proof of life.
    next.table = held
    // §6 — opening as proof of life is a knob: turning it off makes the cut much
    // harsher, since winning a cycle no longer protects you.
    if (state.rules?.openingCountsAsBeat !== false) {
      next.hasBeaten = state.hasBeaten.map((b, i) => (i === seat ? true : b))
    }
  } else if (beats) {
    next.table = held
    next.leader = seat
    next.lastBeater = seat // game-wide, unlike `leader` which endCycle clears
    next.hasBeaten = state.hasBeaten.map((b, i) => (i === seat ? true : b))
    // §7 — display only. The challenge STARTS when someone holding exactly the
    // face-up threshold lands a beat, and once started, every later beat in the
    // cycle takes it over regardless of hand size.
    if (state.challenge || hand.length === faceUpAt(state)) next.challenge = { seat, card: held }
  } else {
    // §5 — revealed to everyone, gone from the hand, and it wins nothing: the table
    // card and the beat leader are both unchanged.
    next.reveals = [...state.reveals, { seat, card: held }]
  }

  return { state: settle(next, seat) }
}

/**
 * Pass by discarding one card FACE-DOWN (§3). The card is hidden from everyone and
 * gone for good — only `discards[seat]`, a count, is ever public. Callers must not
 * put the card anywhere the state can carry it.
 */
export function applyPass(state, seat, card) {
  const err = turnError(state, seat)
  if (err) return { error: err }
  // §3 — the opener must play a real card; opening by passing is not allowed.
  if (state.table === null) return { error: "You're opening the cycle — you must play a card." }
  const hand = state.hands[seat]
  if (hand.length <= faceUpAt(state)) return { error: 'Down to your last cards — they must be played face-up.' }
  const held = hand.find((c) => c.id === card.id)
  if (!held) return { error: 'That card is not in your hand' }

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== held.id) : h))
  const next = {
    ...state,
    hands,
    discards: state.discards.map((d, i) => (i === seat ? d + 1 : d)),
  }

  // §6 — the 2-card cut. Only a PASS can trigger it: playing a card means you either
  // opened or beat, both of which set hasBeaten. So it always fires before the seat
  // reaches §5's face-up stage, and the two rules can never conflict. Their cards
  // are dropped face-down and never revealed — we simply stop reading the hand.
  if (hands[seat].length <= faceUpAt(state) && !state.hasBeaten[seat]) {
    next.eliminated = state.eliminated.map((e, i) => (i === seat ? true : e))
  }

  return { state: settle(next, seat) }
}

// ── Views ─────────────────────────────────────────────────────────────────────

const SUIT_MARK = { spades: '♠', clubs: '♣', diamonds: '♦', hearts: '♥' }

/** What the seat may do right now — drives which buttons the board enables. */
export function legalMoves(state, seat) {
  if (state.phase !== 'playing' || state.currentPlayer !== seat || state.eliminated[seat]) {
    return { canPlay: [], canPass: false, mustOpen: false }
  }
  const hand = state.hands[seat]
  const mustOpen = state.table === null
  // At ≤2 cards every card is playable, beating or not (§5).
  const canPlay = mustOpen || hand.length <= faceUpAt(state) ? hand : hand.filter((c) => canBeat(c, state.table))
  return { canPlay, canPass: !mustOpen && hand.length > faceUpAt(state), mustOpen }
}

/**
 * The flags a game:play emit carries so the server can settle the pot. Kanteal has
 * ONE winner and no ranking beyond first place (§4), so `rankings` is a single entry
 * — unlike Teang Len, which ranks every finisher.
 */
export function deriveFlags(state) {
  if (state.phase !== 'over' || state.winner === null) return {}
  return {
    gameOver: true,
    rankings: [{ playerId: state.seats[state.winner].playerId, rank: 1 }],
  }
}

export const mySeatIndex = (state, playerId) => state.seats.findIndex((s) => s.playerId === playerId)
export { SUIT_MARK }
