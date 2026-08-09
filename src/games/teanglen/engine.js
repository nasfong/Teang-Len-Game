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
export const cardValue = (c) => rankIdx(c) * 4 + suitIdx(c)
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
  // full house (fulu) — a triple + a pair on ADJACENT ranks: 333+44, 444+55, JJJ+QQ
  // (either way round, so 44+333 is the same hand). NOT any triple with any pair —
  // a cross like 555+KK is not a fulu. No 2 either, so A+2 can't sneak in on the
  // rank order the way it would if adjacency alone were the test — the same reason
  // straights and double sequences exclude 2s.
  if (features.allowFulu && n === 5 && groups.length === 2 && !hasTwo(sorted)) {
    const triple = groups.find((g) => g.cards.length === 3)
    const pair = groups.find((g) => g.cards.length === 2)
    if (triple && pair && Math.abs(triple.rankIdx - pair.rankIdx) === 1) {
      return play('full_house', { tripleIdx: triple.rankIdx, pairIdx: pair.rankIdx })
    }
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

// The three bomb cuts (§5). A bomb is defined by WHAT IT KILLS, so each kind names
// the 2s it destroys — which is also what the chặt penalty is priced on, hence the
// named constants rather than a bare boolean.
export const BOMB_QUAD = 'quad' // four of a kind over a lone 2
export const BOMB_FLUSH5 = 'flush_straight_5' // 5-card flush straight over a lone 2
export const BOMB_FOUR_PAIRS = 'four_pairs' // 4+ consecutive pairs over a pair of 2s

/** Which bomb cut `ch` makes on `cur`, or null if it isn't one (§5). */
export function bombCut(ch, cur, features = DEFAULT_FEATURES) {
  if (!ch || !cur) return null
  if (features.allowSquareBomb && ch.type === 'quad' && cur.type === 'single' && isTwoCard(cur.top)) return BOMB_QUAD
  if (features.allowFlushStraightBomb && ch.type === 'flush_straight' && ch.count === 5 && cur.type === 'single' && isTwoCard(cur.top)) return BOMB_FLUSH5
  if (features.allowFourPairBomb && ch.type === 'double_sequence' && ch.count >= 8 && cur.type === 'pair' && isTwoCard(cur.top)) return BOMB_FOUR_PAIRS
  return null
}

// A bomb cuts a specific target out of the normal type rules (§5).
const isBomb = (ch, cur, features) => bombCut(ch, cur, features) !== null

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
export function playsOfType(hand, type, count, prefer = null) {
  const sorted = sortCards(hand)
  const groups = groupByRank(sorted)
  const out = []
  if (type === 'single') return sorted.map((c) => [c])
  if (type === 'pair') return groups.filter((g) => g.cards.length >= 2).map((g) => pickN(g.cards, 2, prefer))
  if (type === 'triple') return groups.filter((g) => g.cards.length >= 3).map((g) => pickN(g.cards, 3, prefer))
  if (type === 'quad') return groups.filter((g) => g.cards.length === 4).map((g) => g.cards)
  if (type === 'full_house') {
    // Adjacent ranks only, and no 2 — see classify. Enforced here as well as there so
    // the enumerator never offers a combination the classifier will just reject.
    const triples = groups.filter((g) => g.cards.length >= 3 && g.rankIdx !== TWO)
    const pairs = groups.filter((g) => g.cards.length >= 2 && g.rankIdx !== TWO)
    for (const t of triples) {
      for (const p of pairs) {
        if (Math.abs(p.rankIdx - t.rankIdx) !== 1) continue
        out.push([...pickN(t.cards, 3, prefer), ...pickN(p.cards, 2, prefer)])
      }
    }
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
export function candidatePlays(hand, current, prefer = null) {
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
    // Count first (smallest commitment), then SUITED before mixed, then weakest.
    // The suited tie-break is the point: when the same cards can be read as either a
    // plain straight or a same-suit one, the flush straight is the stronger hand for
    // free — same cards, same count, but it also beats any mixed straight of that
    // length. Ranked above `strength` because that would prefer the mixed run
    // whenever its top card happened to be lower.
    .sort((a, b) => a.count - b.count || suitedRank(b) - suitedRank(a) || strength(a) - strength(b))
  return beats.length ? beats[0].cards : null
}

// Suited runs sort ahead of mixed ones in smart-select. Only flush_straight can be
// the "same cards, better hand" case — every other type is one reading or none.
const suitedRank = (play) => (play.type === 'flush_straight' ? 1 : 0)

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

// ============================================================================
// PRO BOT — a materially stronger opponent, built on the SAME primitives as above
// (classify / canBeat / candidatePlays / playsOfType / strength / isBomb). Pure
// functions, no new deps, no React/DOM. The greedy `chooseBotMove` is left exactly
// as it was; everything here is additive, wired in via `chooseBotMovePro`.
//
// Three ideas make it stronger than "lowest single always":
//   1. Leading uses a hand DECOMPOSITION — it partitions the whole hand into the
//      fewest melds (turns-to-empty) and leads the weakest one, keeping 2s/bombs and
//      never breaking a pair/run to shed a single.
//   2. Following is DANGER-AWARE — when an opponent is about to go out it stops
//      conserving and blocks (strong beat, or a bomb to cut a 2); otherwise it keeps
//      the greedy weakest-beat, choosing the beat that leaves the best-shaped hand.
//   3. ENDGAME aggression — when its own hand is small it plays to go out fastest,
//      spending strong cards / bombs if that clears the hand.
// ============================================================================

const DANGER_THRESHOLD = 2 // an opponent at/below this many cards is "about to win"
const ENDGAME_THRESHOLD = 4 // at/below this many cards, the bot plays to go out
const ORPHAN_BELOW = RANKS.indexOf('J') * 4 // a low lone single is a mild liability

// Highest card value in a set — a meld's "strength" without re-classifying.
const topValue = (cards) => Math.max(...cards.map(cardValue))
// Remove a set of cards (by id) from a list, preserving order.
const removeCards = (list, taken) => {
  const ids = new Set(taken.map((c) => c.id))
  return list.filter((c) => !ids.has(c.id))
}
// Re-bind a chosen set of cards to the caller's own hand objects (decompose results
// are memoized and may reference an earlier equal hand — match back by id).
const fromHand = (hand, cards) => cards.map((c) => hand.find((h) => h.id === c.id) ?? c)

// Every legal meld that INCLUDES `anchor` (the lowest remaining card). Anchoring on
// the lowest card makes the partition deterministic — each card is placed exactly
// once — and keeps the branching factor small.
function combosWithAnchor(remaining, anchor, features) {
  const combos = [[anchor]] // a lone single is always available
  const aRank = rankIdx(anchor)
  const sameRank = remaining.filter((c) => rankIdx(c) === aRank)
  const others = sameRank.filter((c) => c.id !== anchor.id)
  if (sameRank.length >= 2) combos.push([anchor, ...others.slice(0, 1)]) // pair
  if (sameRank.length >= 3) combos.push([anchor, ...others.slice(0, 2)]) // triple
  if (sameRank.length === 4) combos.push([...sameRank]) // quad

  const byRank = new Map()
  for (const c of remaining) {
    if (!byRank.has(rankIdx(c))) byRank.set(rankIdx(c), [])
    byRank.get(rankIdx(c)).push(c)
  }
  // straights (≥3) starting at the anchor's rank — it's the lowest card, so any run
  // it's in starts here. No 2 (aRank+len ≤ TWO keeps the top rank below 2).
  for (let len = 3; aRank + len <= TWO; len++) {
    const ranks = Array.from({ length: len }, (_, k) => aRank + k)
    if (!ranks.every((r) => byRank.has(r))) break
    combos.push(ranks.map((r) => (r === aRank ? anchor : byRank.get(r)[0])))
  }
  // double sequences (consecutive pairs) starting at the anchor's rank.
  if (sameRank.length >= 2) {
    for (let pairs = 2; aRank + pairs <= TWO; pairs++) {
      const ranks = Array.from({ length: pairs }, (_, k) => aRank + k)
      if (!ranks.every((r) => (byRank.get(r)?.length ?? 0) >= 2)) break
      combos.push(ranks.flatMap((r) => (r === aRank ? [anchor, others[0]] : byRank.get(r).slice(0, 2))))
    }
  }
  // full house (one meld instead of a separate triple + pair) — anchor as the triple,
  // or as half of the pair. The search decides whether it's worth spending the cards.
  // The partner rank must be ADJACENT and not a 2 (see classify): the final filter
  // would drop anything else anyway, this just stops generating it.
  const fuluPartner = (r) => Math.abs(r - aRank) === 1 && r !== TWO && aRank !== TWO
  if (features.allowFulu) {
    if (sameRank.length >= 3) {
      for (const [r, cards] of byRank) if (fuluPartner(r) && cards.length >= 2) combos.push([anchor, ...others.slice(0, 2), ...cards.slice(0, 2)])
    }
    if (sameRank.length >= 2) {
      for (const [r, cards] of byRank) if (fuluPartner(r) && cards.length >= 3) combos.push([anchor, others[0], ...cards.slice(0, 3)])
    }
  }
  return combos.filter((cards) => classify(cards, features))
}

// One meld = one turn to shed, so minimizing melds minimizes turns-to-empty. A low
// lone single is a slight liability, so it costs a hair more — but the integer turn
// count always dominates (the penalty can never cross a whole meld).
const meldCost = (combo) => 1 + (combo.length === 1 && cardValue(combo[0]) < ORPHAN_BELOW ? 0.01 : 0)

// Cache decompositions across the whole process — the same hand-shape recurs a lot
// (leads, and every calm-follow candidate is scored on its resulting shape). The
// elite AI's look-ahead hammers this, so it's capped: drop the oldest half when full
// rather than growing without bound across a long session.
const DECOMP_CACHE_MAX = 20000
const _decompCache = new Map()
function cacheDecomp(key, value) {
  if (_decompCache.size >= DECOMP_CACHE_MAX) {
    for (const k of [..._decompCache.keys()].slice(0, DECOMP_CACHE_MAX / 2)) _decompCache.delete(k)
  }
  _decompCache.set(key, value)
}

/**
 * Partition a hand into the fewest melds (a small memoized recursive search over the
 * lowest-card anchor). Returns { melds:[[card,…],…], cost }. Not guaranteed optimal,
 * but far better than treating every card as a single. Exposed for inspection/tuning.
 */
export function decompose(cards, features = DEFAULT_FEATURES) {
  if (!cards.length) return { melds: [], cost: 0 }
  const outerKey = sortCards(cards).map((c) => c.id).join(',')
  const cached = _decompCache.get(outerKey)
  if (cached) return cached

  const memo = new Map()
  function solve(rem) {
    if (rem.length === 0) return { melds: [], cost: 0 }
    const key = rem.map((c) => c.id).join(',')
    const hit = memo.get(key)
    if (hit) return hit
    const anchor = rem[0]
    let best = null
    for (const combo of combosWithAnchor(rem, anchor, features)) {
      const sub = solve(removeCards(rem, combo))
      const cost = sub.cost + meldCost(combo)
      if (!best || cost < best.cost) best = { melds: [combo, ...sub.melds], cost }
    }
    memo.set(key, best)
    return best
  }
  const result = solve(sortCards(cards))
  cacheDecomp(outerKey, result)
  return result
}

/** How "close to empty" a hand is — its minimum meld count. Lower is better. A pure
 *  scalar so the follow heuristics are inspectable/tunable. */
export function scoreHandShape(hand, features = DEFAULT_FEATURES) {
  return decompose(hand, features).cost
}

/** Cost of making a play, for the calm-follow choice: leave a well-shaped hand (few
 *  melds) AND spend weak cards. Lower is better. */
export function evaluatePlay(hand, cards, context = {}, features = DEFAULT_FEATURES) {
  return scoreHandShape(removeCards(hand, cards), features) + (0.1 * topValue(cards)) / 4
}

// Leading: lead the weakest meld from the best decomposition, so 2s/bombs (high
// strength) are kept for later. If the weakest is a lone single but a nearby low
// COMBO exists, lead the combo instead — it sheds more and singles are hardest to
// offload later.
function leadMove(hand, context, features) {
  if (hand.length <= 1) return hand.length ? [...hand] : null
  const { melds } = decompose(hand, features)
  const ranked = [...melds].sort((a, b) => topValue(a) - topValue(b))
  const weakest = ranked[0]
  const chosen =
    weakest.length === 1 ? (ranked.find((m) => m.length > 1 && topValue(m) - topValue(weakest) <= 8) ?? weakest) : weakest
  return fromHand(hand, chosen)
}

// Following: beat-or-pass, tuned by danger and the bot's own hand size.
function followMove(hand, current, context, features) {
  const beats = candidatePlays(hand, current)
    .map((cards) => ({ cards, play: classify(cards, features) }))
    .filter((b) => b.play && canBeat(b.play, current, features))
  if (!beats.length) return null // nothing beats it — must pass

  const bombs = beats.filter((b) => isBomb(b.play, current, features))
  const normals = beats.filter((b) => !isBomb(b.play, current, features))
  const myCount = hand.length
  const oppCounts = context.opponentCounts ?? []
  const minOpp = oppCounts.length ? Math.min(...oppCounts) : Infinity
  const danger = minOpp <= (context.dangerThreshold ?? DANGER_THRESHOLD)
  const endgame = myCount <= (context.endgameThreshold ?? ENDGAME_THRESHOLD)
  const tableIsTwos = (current.type === 'single' || current.type === 'pair') && isTwoCard(current.top)

  // ENDGAME: play to go out. Take a hand-clearing beat if one exists; else shed the
  // most cards. Bombs are fair game here — clearing the hand ends the game.
  if (endgame) {
    const clearing = beats.filter((b) => b.cards.length === myCount)
    if (clearing.length) return clearing.sort((a, b) => strength(a.play) - strength(b.play))[0].cards
    return [...beats].sort((a, b) => b.cards.length - a.cards.length || strength(a.play) - strength(b.play))[0].cards
  }

  // DANGER: an opponent is about to win — block instead of conserving. Cut a 2/2s
  // with a bomb if we hold one (denies the strongest card in the game); otherwise beat
  // with a STRONG card (a minimal beat is easy to re-beat). Don't waste bombs off a 2
  // unless it's this blocking case.
  if (danger) {
    if (tableIsTwos && bombs.length) return bombs.sort((a, b) => strength(a.play) - strength(b.play))[0].cards
    const pool = normals.length ? normals : bombs
    return pool.sort((a, b) => strength(b.play) - strength(a.play))[0].cards
  }

  // CALM: conserve. Nobody's in danger, so never spend a bomb — hoard it (pass if a
  // bomb is the only answer). Among normal beats, pick the one that leaves the best-
  // shaped hand, tie-broken by the weakest card spent.
  if (!normals.length) return null
  return normals
    .map((b) => ({ b, cost: evaluatePlay(hand, b.cards, context, features) }))
    .sort((a, b) => a.cost - b.cost || strength(a.b.play) - strength(b.b.play))[0].b.cards
}

/**
 * Strong ("pro") opponent move. Same call shape as chooseBotMove plus a `context`:
 *   context = {
 *     opponentCounts?: number[]   // remaining card counts of the OTHER live seats
 *     dangerThreshold?: number    // opponent "about to win" cutoff (default 2)
 *     endgameThreshold?: number   // own "play to go out" cutoff (default 4)
 *     history?: unknown           // this trick's plays, accepted but not required
 *   }
 * All fields optional with sane defaults, so any existing caller can pass nothing.
 * Returns the cards to play, or null to pass (only legal when following).
 */
export function chooseBotMovePro(hand, current, context = {}, features = DEFAULT_FEATURES) {
  if (!hand || !hand.length) return null
  return current ? followMove(hand, current, context, features) : leadMove(hand, context, features)
}
