import { deal, validatePlay, sortCards, DEFAULT_FEATURES } from './engine.js'

// match.js — the PURE, serializable turn flow for an online game. It's a
// seat-agnostic, bot-free port of GameTable's reducer core: every function takes a
// full gameState and returns the next one, so ANY client can compute its own move
// and relay the result. The backend never reads this — it just fans the state out
// (game:update), and every client renders the same authoritative object.
//
// TRUST MODEL (v1): the state carries ALL hands. The relay sends one gameState to
// everyone, so a determined player could read opponents' cards from the payload.
// Fine for a social game; hardening to private per-seat hands is a later step.

const FEATURES = DEFAULT_FEATURES

const nextWhere = (state, from, ok) => {
  for (let s = 1; s <= state.seats.length; s++) {
    const q = (from + s) % state.seats.length
    if (ok(q)) return q
  }
  return from
}
const nextActive = (state, from) => nextWhere(state, from, (q) => !state.finished[q])
const nextToAct = (state, from) => nextWhere(state, from, (q) => !state.finished[q] && !state.skipped[q])

// Deal a fresh game. `seats` = [{ playerId, name }] in seat order. Everything here
// is plain JSON (card objects are { rank, suit, id }), safe to send over sockets.
//
// `startingPlayerId` implements the server-owned `winnerStartsNextGame` rule (see
// backend/src/config/rules.ts): pass the previous match's winner and they lead this
// one. Omit it — the room's FIRST match, or the rule turned off — and the opener is
// the 3♠ holder as usual. A winner who has since left the room isn't in `seats`, so
// that falls back to 3♠ too rather than dead-locking on an absent seat.
export function createMatch(seats, { startingPlayerId = null } = {}) {
  const { hands, starter } = deal(seats.length)
  const winnerSeat = startingPlayerId ? seats.findIndex((s) => s.playerId === startingPlayerId) : -1
  const opener = winnerSeat >= 0 ? winnerSeat : starter
  return {
    seats,
    hands, // hands[seat] = card[]
    current: null, // the play on the table, or null when a lead is owed
    lastPlayer: opener, // owner of the current hand → wins the trick if all pass
    currentPlayer: opener,
    skipped: seats.map(() => false),
    finished: seats.map(() => false),
    ranked: [], // seat indices in finish order
    beaten: [], // the play the current hand covered (drawn peeking behind)
    phase: 'playing', // 'playing' | 'over'
    turnKey: 0, // bumps each turn — the seat-ring timer keys on it
  }
}

// After a play or skip: end the game, resolve the trick, or pass the turn on.
function settle(state, actor) {
  const unranked = state.seats.map((_, i) => i).filter((i) => !state.finished[i])

  // One player left holding cards → auto-ranked last; game over.
  if (unranked.length <= 1) {
    const ranked = [...state.ranked]
    if (unranked.length === 1 && !ranked.includes(unranked[0])) ranked.push(unranked[0])
    return { ...state, ranked, phase: 'over', turnKey: state.turnKey + 1 }
  }

  // Trick resolves when nobody but the hand's owner can still answer.
  if (state.current) {
    const contenders = state.seats
      .map((_, i) => i)
      .filter((i) => !state.finished[i] && !state.skipped[i] && i !== state.lastPlayer)
    if (contenders.length === 0) {
      const leader = state.finished[state.lastPlayer] ? nextActive(state, state.lastPlayer) : state.lastPlayer
      return {
        ...state,
        current: null,
        skipped: state.seats.map(() => false),
        currentPlayer: leader,
        turnKey: state.turnKey + 1,
      }
    }
  }

  return { ...state, currentPlayer: nextToAct(state, actor), turnKey: state.turnKey + 1 }
}

// Apply `seat` playing `cards`. Returns { state } or { error } (bad turn / play).
export function applyPlay(state, seat, cards) {
  if (state.phase !== 'playing') return { error: 'Game is not in progress' }
  if (state.currentPlayer !== seat) return { error: 'Not your turn' }
  const res = validatePlay(cards, state.current, FEATURES)
  if (!res.ok) return { error: res.reason }

  const ids = new Set(cards.map((c) => c.id))
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => !ids.has(c.id)) : h))
  const finished = [...state.finished]
  const ranked = [...state.ranked]
  if (hands[seat].length === 0 && !finished[seat]) {
    finished[seat] = true
    ranked.push(seat)
  }

  const next = {
    ...state,
    hands,
    beaten: state.current ? state.current.cards : [],
    current: res.play,
    lastPlayer: seat,
    finished,
    ranked,
  }
  return { state: settle(next, seat) }
}

// Apply `seat` passing. Returns { state } or { error }.
export function applySkip(state, seat) {
  if (state.phase !== 'playing') return { error: 'Game is not in progress' }
  if (state.currentPlayer !== seat) return { error: 'Not your turn' }
  if (!state.current) return { error: "You're leading — you can't pass." }
  const skipped = [...state.skipped]
  skipped[seat] = true
  return { state: settle({ ...state, skipped }, seat) }
}

// The flags a game:play emit carries so the server can rank finishers + settle the
// pot — derived from the resulting state, never trusted from elsewhere.
export function deriveFlags(state, seat) {
  const flags = {}
  if (state.finished[seat]) {
    flags.playerFinished = true
    flags.finishedRank = state.ranked.indexOf(seat) + 1
  }
  if (state.phase === 'over') {
    flags.gameOver = true
    flags.rankings = state.ranked.map((s, i) => ({ playerId: state.seats[s].playerId, rank: i + 1 }))
  }
  return flags
}

export const mySeatIndex = (state, playerId) => state.seats.findIndex((s) => s.playerId === playerId)
export const lowestCard = (hand) => sortCards(hand)[0]
