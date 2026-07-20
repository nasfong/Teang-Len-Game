// Teang Len rules engine — pure logic, no React, no DOM. Deals, classifies a set
// of cards into one hand type, decides whether one play beats another, and picks
// a move for a demo opponent. Ported from GAME_RULES.md; see that doc for the
// authority on every rule below.
//
// This is the DEMO engine for the workbench: it runs all seats locally so the
// scene is playable single-player. The real game is peer-authoritative
// multiplayer with no bots — chooseBotMove stands in for the other humans here.

// Rank order, weakest → strongest. 3 lowest, 2 highest. Index IS the strength.
export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
// Suit order, weakest → strongest. Index is the tie-breaker when ranks match.
export const SUITS = ['spades', 'clubs', 'diamonds', 'hearts']

const TWO = RANKS.indexOf('2')
const rankIdx = (c) => RANKS.indexOf(c.rank)
const suitIdx = (c) => SUITS.indexOf(c.suit)
// One number that orders any two cards: rank dominates, suit breaks ties.
const cardValue = (c) => rankIdx(c) * 4 + suitIdx(c)
const cardId = (c) => `${c.rank}-${c.suit}`

export const DEFAULT_FEATURES = {
  allowFulu: true,
  allowSquareBomb: true,
  allowFlushStraightBomb: true,
  allowFourPairBomb: true,
}

const byValueAsc = (a, b) => cardValue(a) - cardValue(b)
export const sortCards = (cards) => [...cards].sort(byValueAsc)

function makeDeck() {
  const deck = []
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit, id: `${rank}-${suit}` })
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

/** Deal a full 13 to each seat. Returns the hands (sorted), the raw DEALT order
 *  (pre-sort, for a deal animation that reveals cards as they fell before tidying
 *  them), and the seat that opens — whoever was dealt 3♠, else seat 0. Every card
 *  stays in play: the 3s are kept, so the first game is a full 13-card hand. */
export function deal(numPlayers = 4) {
  const deck = shuffle(makeDeck())
  const raw = Array.from({ length: numPlayers }, () => [])
  for (let i = 0; i < 13 * numPlayers; i++) raw[i % numPlayers].push(deck[i])

  let starter = 0
  raw.forEach((hand, seat) => {
    if (hand.some((c) => c.rank === '3' && c.suit === 'spades')) starter = seat
  })
  // Snapshot the dealt order BEFORE sorting — the UI shows this first, then flips
  // to the sorted hand. (Copied so sortCards can't disturb it.)
  const dealt = raw.map((hand) => [...hand])
  // const hands = raw.map((hand) => sortCards(hand.filter((c) => c.rank !== '3'))) // enable first game remove 3333 cards
  const hands = raw.map((hand) => sortCards(hand))
  return { hands, dealt, starter }
}

// --- classification ----------------------------------------------------------

// Group a sorted hand into runs of equal rank: [{ rankIdx, cards }], rank-ascending.
function groupByRank(sorted) {
  const groups = []
  for (const c of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.rankIdx === rankIdx(c)) last.cards.push(c)
    else groups.push({ rankIdx: rankIdx(c), cards: [c] })
  }
  return groups
}

const isConsecutive = (idxs) => idxs.every((v, i) => i === 0 || v === idxs[i - 1] + 1)
const hasTwo = (sorted) => sorted.some((c) => rankIdx(c) === TWO)

/**
 * Classify a set of cards into exactly one hand type, or null if it's not a
 * legal combination. Priority order per §3: flush_straight → quad →
 * double_sequence → full_house → straight → triple → pair → single.
 *
 * Returns a "play": { type, count, cards, top, tripleIdx?, pairIdx? } where
 * `top` is the highest card and drives most comparisons.
 */
export function classify(cards, features = DEFAULT_FEATURES) {
  const n = cards.length
  if (n === 0) return null
  const sorted = sortCards(cards)
  const top = sorted[n - 1]
  const groups = groupByRank(sorted)
  const rankIdxs = groups.map((g) => g.rankIdx)
  const consecutiveRanks = groups.length === n && isConsecutive(rankIdxs) // one card per rank, in a row
  const sameSuit = sorted.every((c) => c.suit === sorted[0].suit)
  const play = (type, extra = {}) => ({ type, count: n, cards: sorted, top, ...extra })

  // flush straight — ≥3, all one suit, consecutive, no 2
  if (n >= 3 && sameSuit && consecutiveRanks && !hasTwo(sorted)) return play('flush_straight')
  // quad — four of a kind
  if (n === 4 && groups.length === 1) return play('quad')
  // double sequence — ≥4, even, every rank a consecutive pair, no 2
  if (n >= 4 && n % 2 === 0 && groups.length === n / 2 && groups.every((g) => g.cards.length === 2) && isConsecutive(rankIdxs) && !hasTwo(sorted)) {
    return play('double_sequence')
  }
  // full house (fulu) — exactly a triple + a pair
  if (features.allowFulu && n === 5 && groups.length === 2) {
    const triple = groups.find((g) => g.cards.length === 3)
    const pair = groups.find((g) => g.cards.length === 2)
    if (triple && pair) return play('full_house', { tripleIdx: triple.rankIdx, pairIdx: pair.rankIdx })
  }
  // straight — ≥3 consecutive ranks, no 2
  if (n >= 3 && consecutiveRanks && !hasTwo(sorted)) return play('straight')
  // triple / pair — same rank
  if (n === 3 && groups.length === 1) return play('triple')
  if (n === 2 && groups.length === 1) return play('pair')
  if (n === 1) return play('single')
  return null
}

const isTwoCard = (c) => rankIdx(c) === TWO

// A bomb cuts a specific target out of the normal type rules (§5).
function isBomb(ch, cur, features) {
  // square bomb: quad cuts a lone 2
  if (features.allowSquareBomb && ch.type === 'quad' && cur.type === 'single' && isTwoCard(cur.top)) return true
  // flush-straight bomb: exactly 5 cuts a lone 2
  if (features.allowFlushStraightBomb && ch.type === 'flush_straight' && ch.count === 5 && cur.type === 'single' && isTwoCard(cur.top)) return true
  // four-pair bomb: double sequence ≥8 cuts a pair of 2s
  if (features.allowFourPairBomb && ch.type === 'double_sequence' && ch.count >= 8 && cur.type === 'pair' && isTwoCard(cur.top)) return true
  return false
}

/** Does `ch` beat the `cur` hand on the table? (§4 evaluation order.) */
export function canBeat(ch, cur, features = DEFAULT_FEATURES) {
  if (!ch || !cur) return false
  // Triple 2 is immune to everything, bombs included — checked first.
  if (cur.type === 'triple' && rankIdx(cur.top) === TWO) return false
  // Bomb override (out-of-type cut).
  if (isBomb(ch, cur, features)) return true
  // A flush straight beats a same-length normal straight (cross-type).
  if (cur.type === 'straight' && ch.type === 'flush_straight' && ch.count === cur.count) return true
  // Otherwise types and counts must match.
  if (ch.type !== cur.type || ch.count !== cur.count) return false
  // Full house: triple rank first, then pair rank.
  if (ch.type === 'full_house') {
    if (ch.tripleIdx !== cur.tripleIdx) return ch.tripleIdx > cur.tripleIdx
    return ch.pairIdx > cur.pairIdx
  }
  // Everything else: strictly higher top card (rank, then suit).
  return cardValue(ch.top) > cardValue(cur.top)
}

/** Validate a human play: classify it, and (if a hand is on the table) require
 *  it to beat that hand. Returns { ok, play?, reason? }. */
export function validatePlay(cards, current, features = DEFAULT_FEATURES) {
  const play = classify(cards, features)
  if (!play) return { ok: false, reason: 'Not a valid combination' }
  if (!current) return { ok: true, play }
  if (!canBeat(play, current, features)) return { ok: false, reason: `That doesn't beat the ${label(current)}` }
  return { ok: true, play }
}

export function label(play) {
  if (!play) return 'table'
  const names = {
    single: 'card',
    pair: 'pair',
    triple: 'triple',
    quad: 'four of a kind',
    straight: 'straight',
    flush_straight: 'flush straight',
    double_sequence: 'double run',
    full_house: 'full house',
  }
  return names[play.type] ?? play.type
}

// --- opponent move -----------------------------------------------------------

/** Take k cards from a same-rank group, weakest first — but if `prefer` is one of
 *  them, keep it. Rank is all that matters for pairs/triples/runs, so which COPY we
 *  use is free; honouring `prefer` is what lets smart-select build a combination
 *  around the exact card the player tapped instead of a same-rank sibling. */
const pickN = (cards, k, prefer) => {
  if (prefer && cards.some((c) => c.id === prefer.id)) {
    const rest = cards.filter((c) => c.id !== prefer.id).slice(0, k - 1)
    return sortCards([prefer, ...rest])
  }
  return cards.slice(0, k)
}

// Enumerate every legal play of a given type+count a hand can make. Drives both the
// opponent's move and the player's smart selection. `prefer` (optional) biases
// same-rank choices toward that card — see pickN.
function playsOfType(hand, type, count, prefer = null) {
  const sorted = sortCards(hand)
  const groups = groupByRank(sorted)
  const out = []
  if (type === 'single') return sorted.map((c) => [c])
  if (type === 'pair') return groups.filter((g) => g.cards.length >= 2).map((g) => pickN(g.cards, 2, prefer))
  if (type === 'triple') return groups.filter((g) => g.cards.length >= 3).map((g) => pickN(g.cards, 3, prefer))
  if (type === 'quad') return groups.filter((g) => g.cards.length === 4).map((g) => g.cards)
  if (type === 'full_house') {
    const triples = groups.filter((g) => g.cards.length >= 3)
    const pairs = groups.filter((g) => g.cards.length >= 2)
    for (const t of triples) for (const p of pairs) if (p.rankIdx !== t.rankIdx) out.push([...pickN(t.cards, 3, prefer), ...pickN(p.cards, 2, prefer)])
    return out
  }
  if (type === 'straight' || type === 'flush_straight') {
    const len = count
    const byRank = new Map(groups.map((g) => [g.rankIdx, g.cards]))
    for (let start = 0; start + len <= TWO; start++) {
      // ranks start..start+len-1 (all < TWO, so no 2)
      const window = Array.from({ length: len }, (_, k) => start + k)
      if (!window.every((r) => byRank.has(r))) continue
      if (type === 'straight') {
        out.push(window.map((r) => pickN(byRank.get(r), 1, prefer)[0])) // lowest suit each — mixed is fine
      } else {
        for (const suit of SUITS) {
          const run = window.map((r) => byRank.get(r).find((c) => c.suit === suit)).filter(Boolean)
          if (run.length === len) out.push(run)
        }
      }
    }
    return out
  }
  if (type === 'double_sequence') {
    const pairsLen = count / 2
    const byRank = new Map(groups.filter((g) => g.cards.length >= 2).map((g) => [g.rankIdx, g.cards]))
    for (let start = 0; start + pairsLen <= TWO; start++) {
      const window = Array.from({ length: pairsLen }, (_, k) => start + k)
      if (!window.every((r) => byRank.has(r))) continue
      out.push(window.flatMap((r) => pickN(byRank.get(r), 2, prefer)))
    }
    return out
  }
  return out
}

/** Every play a hand could answer `current` with — the same-type plays plus the
 *  cross-type answers (a flush straight over a straight, bombs that cut 2s). Shared
 *  by the opponent AI and the player's smart selection so "what can answer this?"
 *  is defined in exactly one place. */
function candidatePlays(hand, current, prefer = null) {
  const out = playsOfType(hand, current.type, current.count, prefer)
  if (current.type === 'straight') out.push(...playsOfType(hand, 'flush_straight', current.count, prefer))
  if (current.type === 'single' && isTwoCard(current.top)) {
    out.push(...playsOfType(hand, 'quad', 4, prefer))
    out.push(...playsOfType(hand, 'flush_straight', 5, prefer))
  }
  if (current.type === 'pair' && isTwoCard(current.top)) {
    for (let len = 8; len <= 12; len += 2) out.push(...playsOfType(hand, 'double_sequence', len, prefer))
  }
  return out
}

/**
 * Smart selection: the player tapped `tapped`, so work out the whole combination
 * they most likely meant. Returns the cards to select, or null if that card can't
 * be part of anything that beats the table (the caller then falls back to a plain
 * toggle so manual selection always still works).
 *
 * Picks the SMALLEST hand that beats `current`, then the weakest of those — same
 * "don't spend strong cards early" instinct as chooseBotMove, and it means a tapped
 * pair auto-completes to a pair rather than to a bomb.
 *
 * With no hand on the table the player is leading and any combination is legal, so
 * there is nothing to solve for — just the tapped card.
 */
export function suggestSelection(hand, current, tapped, features = DEFAULT_FEATURES) {
  if (!tapped) return null
  if (!current) return [tapped]
  const beats = candidatePlays(hand, current, tapped)
    .filter((cards) => cards.some((c) => c.id === tapped.id))
    .map((cards) => classify(cards, features))
    .filter((play) => play && canBeat(play, current, features))
    .sort((a, b) => a.count - b.count || strength(a) - strength(b))
  return beats.length ? beats[0].cards : null
}

/**
 * Pick a move for an opponent seat.
 *  - Opening (no current hand): lead the lowest single — always legal, and it
 *    sheds the weakest card, which is sound basic strategy.
 *  - Otherwise: the weakest same-type play that beats the table, plus any bomb
 *    that can cut a 2. If nothing beats it, pass.
 * Returns an array of cards to play, or null to pass.
 */
export function chooseBotMove(hand, current, features = DEFAULT_FEATURES) {
  if (!current) {
    const sorted = sortCards(hand)
    return sorted.length ? [sorted[0]] : null
  }

  // Same-type plays plus the cross-type answers (flush straight over a straight,
  // bombs that cut 2s) — see candidatePlays.
  const beats = candidatePlays(hand, current)
    .map((cards) => classify(cards, features))
    .filter((play) => play && canBeat(play, current, features))
    // Weakest legal beat: keep the strong cards for later.
    .sort((a, b) => strength(a) - strength(b))

  return beats.length ? beats[0].cards : null
}

// A single ordering scalar for "how strong is this play", for the bot's
// weakest-first choice. Full house ranks on its triple; everything else on top.
function strength(play) {
  if (play.type === 'full_house') return play.tripleIdx * 4
  return cardValue(play.top)
}

export { cardId }
