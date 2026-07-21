// Kanteal (កន្ទេល) rules engine — pure logic, no React, no DOM.
//
// Almost nothing here is shared with Teang Len, which is the point of keeping each
// game's rules behind its own door (see ../contract.js):
//
//   • ranks run 2 → A, not 3 → 2
//   • SUITS ARE NEVER COMPARED — there is no trump and no suit tie-break
//   • one card per turn; no pairs, straights or bombs, so no `classify` step
//   • a "beat" is same suit AND strictly higher rank — nothing else beats
//
// See the rule spec for the authority on every rule below; section numbers are
// quoted in the comments.

// §1 — low → high. Index IS the rank's strength. 2 is the WEAKEST card.
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

// §1 — listed only to build the deck. Deliberately NOT ordered: suits are never
// ranked against each other, so nothing may read an index out of this array.
export const SUITS = ['spades', 'clubs', 'diamonds', 'hearts']

export const HAND_SIZE = 6
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

// §5/§6 — the hand size at which hidden passing stops and the elimination cut is
// measured. One knob, named once: the spec's balance note calls this out as the
// first thing to tune if the 2-card cut proves too harsh.
export const FACE_UP_AT = 2

const rankIdx = (c) => RANKS.indexOf(c.rank)
const cardId = (c) => `${c.rank}-${c.suit}`

/**
 * §2 — the whole beat rule. Same suit and strictly greater rank; ties do not beat.
 * A null table card means the cycle is being opened, where any card is legal (§3).
 */
export function canBeat(card, table) {
  if (!table) return true
  return card.suit === table.suit && rankIdx(card) > rankIdx(table)
}

function makeDeck() {
  const deck = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit, id: cardId({ rank, suit }) })
  return deck
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * §1 — six cards each, dealt round-robin. The rest of the deck is UNUSED: there is
 * no draw pile and no refills, so a hand only ever shrinks and the cards in play
 * are fixed at `numPlayers × 6`.
 */
export function deal(numPlayers) {
  const deck = shuffle(makeDeck())
  const hands = Array.from({ length: numPlayers }, () => [])
  for (let i = 0; i < HAND_SIZE; i++) {
    for (let p = 0; p < numPlayers; p++) hands[p].push(deck[i * numPlayers + p])
  }
  return { hands }
}

/** Sort for display: grouped by suit, ascending rank within a suit. Suit order here
 *  is presentation only — it carries no rule meaning. */
export const sortCards = (cards) =>
  [...cards].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || rankIdx(a) - rankIdx(b))

/** Every card in `hand` that would legally take the table. */
export const beatingCards = (hand, table) => hand.filter((c) => canBeat(c, table))

/**
 * Pick a move for a seat. Returns { type: 'play', card } or { type: 'pass', card }.
 *
 * Strategy is deliberately plain — this drives AFK autoplay, not an opponent:
 *  - Beat when you can, with the WEAKEST card that does it, keeping strong cards for
 *    later cycles.
 *  - Otherwise pass your weakest card... except at ≤2 cards, where passing is
 *    illegal (§5) and the weakest card is instead revealed face-up.
 * A legal move therefore always exists, which §5 guarantees by design.
 */
export function chooseBotMove(hand, table, { mustOpen = false, faceUpAt = FACE_UP_AT } = {}) {
  if (!hand.length) return null
  const sorted = sortCards(hand)
  const beats = beatingCards(hand, table).sort((a, b) => rankIdx(a) - rankIdx(b))
  if (beats.length) return { type: 'play', card: beats[0] }
  // The opener must play a real card (§3) — passing is not a legal opening.
  if (mustOpen) return { type: 'play', card: sorted[0] }
  const weakest = sorted.reduce((lo, c) => (rankIdx(c) < rankIdx(lo) ? c : lo), sorted[0])
  return { type: hand.length <= faceUpAt ? 'play' : 'pass', card: weakest }
}

export { cardId, rankIdx }
