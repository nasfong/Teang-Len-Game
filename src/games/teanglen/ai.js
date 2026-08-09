// Teang Len ELITE bot — the strategic layer. Pure functions, no deps, no React.
//
// This file decides WHAT to play. It never decides what is LEGAL: classify /
// canBeat / candidatePlays / playsOfType in engine.js remain the only rules, and
// every simulated move goes through match.js's real applyPlay/applySkip. There is
// no second rules implementation here.
//
// The objective is placement, not tidiness: "which move maximises my chance of
// finishing 1st, else 2nd?" Everything below is in service of that one number.
//
// Pipeline per turn:
//   observe → analyse hand → analyse opponents → generate candidates
//   → phase (WIN NOW / BLOCK / ENDGAME / NORMAL) → score in turns → choose
//
// Deterministic: no Math.random, and every sort has a total tie-break, so the same
// state always yields the same move.

import {
  classify,
  canBeat,
  candidatePlays,
  playsOfType,
  decompose,
  bombCut,
  cardValue,
  chooseBotMovePro,
  RANKS,
  SUITS,
  DEFAULT_FEATURES,
} from './engine.js'
import { applyPlay, applySkip } from './match.js'

// ── tuning ───────────────────────────────────────────────────────────────────
// Placement is scaled ×100 so it dominates; the rest only break ties between moves
// that leave the same race position.
// Everything here is in TURNS — the currency the whole bot reasons in — except the
// `placement` scale, which only the optional look-ahead uses. Every number below was
// swept against the pro bot over 600 deals, not guessed; see verify-ai.mjs.
export const WEIGHTS = {
  weakness: 1.0, // how much a meld's weakness inflates its shed cost (see shedCost)
  spend: 0.1, // tie-break: prefer spending the weaker of two equal plays
  unanswerable: 0.4, // a play nobody can beat keeps the lead — worth part of a turn
  // Used only by the optional look-ahead (evaluatePosition).
  placement: 100,
  control: 6,
  power: 1.0,
  cardsLeft: 0.02,
}

// Thresholds for the phase switches, matching the pro bot's so behaviour degrades
// gracefully when this bot's extra information is taken away.
const DANGER_CARDS = 2 // an opponent at/below this is about to go out
const ENDGAME_CARDS = 4 // at/below this, play to go out rather than to conserve

/**
 * Look-ahead depth. DEFAULT 0 — i.e. off.
 *
 * The tree search in section 6 is implemented and correct, and it measured WORSE
 * than not searching (2.38 vs 2.11 mean placement over 600 deals): the rollouts run
 * many turns before hitting a leaf, so tiny differences in my move produce wildly
 * different leaf positions and the value is mostly noise. Left in and switchable —
 * with a stronger leaf evaluator it should pay off — but not on by default, because
 * shipping it on would make the bot weaker.
 */
export const SEARCH_DEPTH = 0
const CANDIDATES_ROOT = 8 // deeply evaluated at the root
const CANDIDATES_INNER = 3 // …and deeper in the tree
const ROLLOUT_GUARD = 60 // hard stop on a simulated turn loop

// A lone single at or below this is hard to shed — it only leaves on a lead.
const ORPHAN_CUTOFF = RANKS.indexOf('J') * 4

// Average cards per meld, used ONLY to guess an unseen hand's turns-to-empty.
const CARDS_PER_MELD = 1.8

const isTwo = (c) => c.rank === '2'
const idKey = (cards) => cards.map((c) => c.id).sort().join('|')
const topValue = (cards) => Math.max(...cards.map(cardValue))

// ── 1. observe ───────────────────────────────────────────────────────────────

const FULL_DECK = RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}-${suit}`))

/**
 * The AI's view of the world.
 *
 * `omniscient` is the SWAP POINT for real multiplayer. True (the local/bot game)
 * reads opponents' actual hands; false leaves `hand: null` on every opponent and
 * every consumer falls back to what a real player could observe — card counts and
 * the played pile. Nothing downstream reads state.hands directly, so flipping this
 * flag is the whole change.
 */
export function observeGame(state, seat, { omniscient = true } = {}) {
  const live = state.seats.map((_, i) => i).filter((i) => !state.finished[i])
  const held = new Set(state.hands.flat().map((c) => c.id))
  const played = FULL_DECK.filter((id) => !held.has(id))

  const opponents = live
    .filter((i) => i !== seat)
    .map((i) => ({
      seat: i,
      count: state.hands[i].length,
      hand: omniscient ? state.hands[i] : null,
    }))

  const mine = new Set(state.hands[seat].map((c) => c.id))
  return {
    omniscient,
    seat,
    myHand: state.hands[seat],
    opponents,
    played, // card ids already out of every hand
    unknown: omniscient ? [] : FULL_DECK.filter((id) => !played.includes(id) && !mine.has(id)),
    current: state.current,
    // Control = the table is mine to answer or mine to lead.
    control: state.current == null ? state.currentPlayer === seat : state.lastPlayer === seat,
  }
}

/** Card memory: how many of `rank` are still unaccounted for (not played, not mine). */
export function remainingOfRank(view, rank) {
  const gone = view.played.filter((id) => id.startsWith(`${rank}-`)).length
  const mine = view.myHand.filter((c) => c.rank === rank).length
  return 4 - gone - mine
}

// ── 2. my hand ───────────────────────────────────────────────────────────────

const _planCache = new Map()

const MAX_CARD_VALUE = (RANKS.length - 1) * 4 + (SUITS.length - 1)

/**
 * How hard a meld is to actually get rid of, in turns.
 *
 * A meld count alone says "5 melds = 5 turns", which is what made the first version
 * of this bot dump its triples early and strand itself holding 3s and 4s. You only
 * shed by LEADING or by BEATING, so a lone 3 may cost several turns' worth of
 * opportunity while a 2 goes whenever you like. Weakness is the fraction of the deck
 * above this meld's top card; bombs float free of it, since they make their own
 * chance to be played.
 */
function shedCost(meld) {
  const play = classify(meld)
  if (!play) return 1
  if (play.type === 'quad' || (play.type === 'flush_straight' && play.count === 5)) return 1
  const weakness = 1 - cardValue(play.top) / MAX_CARD_VALUE
  return 1 + WEIGHTS.weakness * weakness
}

/**
 * Turn my cards into a PLAN: the fewest melds to shed them all, plus the shape facts
 * the evaluator needs.
 *
 * `effectiveTurns` — the sum of shed costs — is the real currency, not `turns`.
 * The partition comes from engine.decompose (memoized); everything else is read off
 * the result, so this stays cheap enough for a look-ahead to call it thousands of
 * times.
 */
export function handPlan(hand) {
  if (!hand.length) return { melds: [], turns: 0, effectiveTurns: 0, deadSingles: 0, twos: 0, bombs: 0, power: 0 }
  const key = idKey(hand)
  const hit = _planCache.get(key)
  if (hit) return hit

  const { melds } = decompose(hand)
  let deadSingles = 0
  let bombs = 0
  let effectiveTurns = 0
  for (const m of melds) {
    effectiveTurns += shedCost(m)
    if (m.length === 1 && !isTwo(m[0]) && cardValue(m[0]) < ORPHAN_CUTOFF) deadSingles++
    const t = classify(m)?.type
    if (t === 'quad' || (t === 'flush_straight' && m.length === 5) || (t === 'double_sequence' && m.length >= 8)) bombs++
  }
  const twos = hand.filter(isTwo).length
  const plan = { melds, turns: melds.length, effectiveTurns, deadSingles, twos, bombs, power: twos + 2 * bombs }
  if (_planCache.size > 20000) _planCache.clear()
  _planCache.set(key, plan)
  return plan
}

/**
 * What playing `cards` costs my PLAN, beyond the cards themselves: how many melds
 * it opens up without finishing them. 0 means the play was whole melds only —
 * 5♠6♥7♣8♦ led as a straight is free, while 5♠ alone out of that run costs 1.
 *
 * This is the cheap stand-in for "don't break a combination", and it's what the
 * prefilter ranks on, so the expensive search never even looks at moves that
 * shatter the hand for no reason.
 */
export function breakCost(melds, cards) {
  const ids = new Set(cards.map((c) => c.id))
  let touched = 0
  let consumed = 0
  for (const m of melds) {
    const hits = m.reduce((k, c) => k + (ids.has(c.id) ? 1 : 0), 0)
    if (!hits) continue
    touched++
    if (hits === m.length) consumed++
  }
  return touched - consumed
}

/** Per-card keep value — how much of my plan leans on this card. Exposed for tuning
 *  and for the debug trace; the evaluator uses breakCost, which is the same idea
 *  applied to a whole play. */
export function cardKeepValue(hand, card) {
  const { melds } = handPlan(hand)
  const meld = melds.find((m) => m.some((c) => c.id === card.id))
  if (!meld) return 0
  if (meld.length === 1) return isTwo(card) ? 3 : 0
  return meld.length + (isTwo(card) ? 3 : 0)
}

// ── 3. opponents ─────────────────────────────────────────────────────────────

/**
 * Turns-to-empty per opponent — the danger measure. Card count alone is wrong: a
 * player on 2♠ A♥ needs two turns and has to win a trick to spend either, while
 * 4♠5♥6♣ is one straight and one turn. With hidden hands this falls back to a
 * count estimate, which is exactly what a human at the table works from.
 */
export function opponentProfile(state, s, view) {
  const hand = view.omniscient ? state.hands[s] : null
  const count = state.hands[s].length
  if (!hand) {
    const est = count === 0 ? 0 : Math.max(1, count / CARDS_PER_MELD)
    return { seat: s, count, turns: Math.round(est), effectiveTurns: est, twos: 0, bombs: 0, known: false }
  }
  const p = handPlan(hand)
  return { seat: s, count, turns: p.turns, effectiveTurns: p.effectiveTurns, twos: p.twos, bombs: p.bombs, known: true }
}

/** Opponents sorted most-dangerous first (fewest turns, then fewest cards). */
export function rankThreats(state, seat, view) {
  return view.opponents
    .map((o) => opponentProfile(state, o.seat, view))
    .sort((a, b) => a.effectiveTurns - b.effectiveTurns || a.count - b.count || a.seat - b.seat)
}

// ── 4. candidates ────────────────────────────────────────────────────────────

/** Every legal LEAD, via the rules engine's own enumerator. */
function allLeads(hand, features) {
  const n = hand.length
  const out = [...playsOfType(hand, 'single', 1)]
  for (const type of ['pair', 'triple', 'quad']) out.push(...playsOfType(hand, type, 0))
  if (features.allowFulu) out.push(...playsOfType(hand, 'full_house', 5))
  for (let len = 3; len <= n; len++) {
    out.push(...playsOfType(hand, 'straight', len))
    out.push(...playsOfType(hand, 'flush_straight', len))
  }
  for (let len = 4; len <= n; len += 2) out.push(...playsOfType(hand, 'double_sequence', len))
  return out
}

/**
 * Legal moves for this seat, deduped. `null` means PASS and is a first-class
 * candidate whenever following — §9: being able to beat the table is not a reason
 * to beat it.
 */
export function generateCandidates(state, seat, features = DEFAULT_FEATURES) {
  const hand = state.hands[seat]
  const current = state.current
  const raw = current ? candidatePlays(hand, current) : allLeads(hand, features)

  const seen = new Set()
  const moves = []
  for (const cards of raw) {
    const play = classify(cards, features)
    if (!play) continue
    if (current && !canBeat(play, current, features)) continue
    const key = idKey(cards)
    if (seen.has(key)) continue
    seen.add(key)
    moves.push({ cards: play.cards, play })
  }
  if (current) moves.push({ cards: null, play: null }) // pass
  return moves
}

/** Can anyone still in the game answer this play? Exact when omniscient, and with
 *  hidden hands it degrades to "assume they can", which is the safe assumption. */
function isUnanswerable(state, seat, play, view, features) {
  if (!view.omniscient) return false
  for (const o of view.opponents) {
    const hand = state.hands[o.seat]
    if (!hand.length) continue
    const answers = candidatePlays(hand, play).some((cs) => {
      const p = classify(cs, features)
      return p && canBeat(p, play, features)
    })
    if (answers) return false
  }
  return true
}

// ── 5. position value ────────────────────────────────────────────────────────

/** Utility of a finishing place. 1st is worth a clear premium over 2nd — §21's
 *  "1st > 2nd > 3rd > avoid last" — and `rank` may be fractional (an estimate). */
export function placementUtility(rank, n) {
  const base = (n - rank) / Math.max(1, n - 1)
  return base + 0.35 * Math.max(0, 2 - rank)
}

/** How many opponents are likely to go out before me. Sigmoid on the turn gap, so a
 *  one-turn lead is a strong but not certain edge, and holding control is worth
 *  about half a turn of tempo. */
function expectedPlacement(myTurns, oppTurns, control) {
  let ahead = 0
  for (const t of oppTurns) {
    const gap = myTurns - t - (control ? 0.5 : 0)
    ahead += 1 / (1 + Math.exp(-gap / 0.8))
  }
  return 1 + ahead
}

/** Static value of a position for `seat`. Terminal positions score their real
 *  placement, which is what makes the search care about blocking: a rollout where
 *  an opponent goes out lands here with a worse rank. */
export function evaluatePosition(state, seat, view) {
  const n = state.seats.length
  if (state.finished[seat]) return WEIGHTS.placement * placementUtility(state.ranked.indexOf(seat) + 1, n)
  if (state.phase === 'over') return WEIGHTS.placement * placementUtility(n, n)

  const mine = handPlan(state.hands[seat])
  const live = state.seats.map((_, i) => i).filter((i) => !state.finished[i] && i !== seat)
  const oppTurns = live.map((s) => opponentProfile(state, s, view).effectiveTurns)
  const control = state.current == null ? state.currentPlayer === seat : state.lastPlayer === seat

  let v = WEIGHTS.placement * placementUtility(expectedPlacement(mine.effectiveTurns, oppTurns, control), n)
  if (control) v += WEIGHTS.control
  v += WEIGHTS.power * mine.power // beyond shedding: what these can still STOP
  v -= WEIGHTS.cardsLeft * state.hands[seat].length
  return v
}

// ── 6. look-ahead ────────────────────────────────────────────────────────────

/** Advance the simulation until it's my turn again (or the game/my hand ends).
 *  Opponents are driven by the existing pro bot — cheap, legal, and a reasonable
 *  model of a competent player. */
function rollForward(state, seat) {
  let s = state
  let guard = 0
  while (s.phase === 'playing' && !s.finished[seat] && s.currentPlayer !== seat && guard++ < ROLLOUT_GUARD) {
    const actor = s.currentPlayer
    const opponentCounts = s.hands.map((h) => h.length).filter((len, i) => i !== actor && len > 0)
    const move = chooseBotMovePro(s.hands[actor], s.current, { opponentCounts })
    const res = move ? applyPlay(s, actor, move) : applySkip(s, actor)
    if (res.error) break // shouldn't happen; never let a bad sim hang the turn
    s = res.state
  }
  return s
}

/** Apply one of MY candidate moves. Returns null if the rules reject it. */
function applyMine(state, seat, cards) {
  const res = cards ? applyPlay(state, seat, cards) : applySkip(state, seat)
  return res.error ? null : res.state
}

/** Value of `state` where it is my turn, searching `depth` more of my decisions. */
function bestValue(state, seat, view, depth, features) {
  if (state.phase === 'over' || state.finished[seat]) return evaluatePosition(state, seat, view)
  if (depth <= 0) return evaluatePosition(state, seat, view)

  const { melds } = handPlan(state.hands[seat])
  const moves = prefilter(generateCandidates(state, seat, features), melds, CANDIDATES_INNER)

  let best = -Infinity
  for (const m of moves) {
    const after = applyMine(state, seat, m.cards)
    if (!after) continue
    const next = rollForward(after, seat)
    let v =
      next.phase === 'over' || next.finished[seat]
        ? evaluatePosition(next, seat, view)
        : bestValue(next, seat, view, depth - 1, features)
    if (v > best) best = v
  }
  return best === -Infinity ? evaluatePosition(state, seat, view) : best
}

/**
 * Cheap ordering so the expensive search only sees plausible moves — ranked on break
 * cost, the single biggest predictor of a bad Teang Len move.
 *
 * The shortlist is DIVERSE on purpose. Ranking by one scalar filled every slot with
 * big multi-card melds (they break nothing and shed the most), so "lead your lowest
 * card" — often the right move — was pruned before the search ever saw it. Each
 * bucket below therefore gets a guaranteed seat.
 */
function prefilter(moves, melds, keep) {
  const scored = moves.map((m) => {
    if (!m.cards) return { ...m, pre: 0, breaks: 0 } // pass
    const breaks = breakCost(melds, m.cards)
    return { ...m, breaks, pre: -3 * breaks + 0.15 * m.cards.length - topValue(m.cards) / 52 }
  })
  const byPre = [...scored].sort((a, b) => b.pre - a.pre || sortKey(a).localeCompare(sortKey(b)))
  const plays = scored.filter((m) => m.cards)
  const cheapest = [...plays].sort((a, b) => topValue(a.cards) - topValue(b.cards) || sortKey(a).localeCompare(sortKey(b)))
  const smallest = [...plays].sort((a, b) => a.cards.length - b.cards.length || topValue(a.cards) - topValue(b.cards))

  const out = []
  const seen = new Set()
  const add = (m) => {
    if (!m) return
    const k = sortKey(m)
    if (seen.has(k)) return
    seen.add(k)
    out.push(m)
  }
  add(scored.find((m) => !m.cards)) // passing is always on the table
  add(cheapest[0]) // shed the weakest thing
  add(smallest[0]) // the smallest commitment
  for (const m of byPre) {
    if (out.length >= keep) break
    add(m)
  }
  return out.slice(0, Math.max(keep, 3))
}

// Total tie-break so equal-scoring moves always resolve the same way (determinism).
const sortKey = (m) => (m.cards ? idKey(m.cards) : '~pass')

// ── 7. decide ────────────────────────────────────────────────────────────────

// A move's cost, in TURNS — lower is better. This is the bot's whole judgement in
// one number: where the hand is left, priced by how hard each remaining meld will
// be to shed, with two corrections the plan alone can't see.
function moveCost(state, seat, m, view, features) {
  const after = applyMine(state, seat, m.cards)
  if (!after) return Infinity
  let cost = handPlan(after.hands[seat]).effectiveTurns
  if (!m.cards) return cost + 1 // passing sheds nothing — a whole turn gone
  // Tie-break: between two plays that leave the same shape, spend the weaker one.
  cost += WEIGHTS.spend * (topValue(m.cards) / MAX_CARD_VALUE)
  // §14 — a play nobody at the table can answer keeps me on lead, so my next meld
  // costs nothing to place. This is where knowing the other hands actually pays.
  if (isUnanswerable(state, seat, m.play, view, features)) cost -= WEIGHTS.unanswerable
  return cost
}

/** Which mode the position is in. Named so the debug trace can say why. */
function phaseOf(state, seat, threats) {
  const mine = state.hands[seat].length
  if (threats.some((t) => t.count <= DANGER_CARDS)) return 'BLOCK'
  if (mine <= ENDGAME_CARDS) return 'ENDGAME'
  return 'NORMAL'
}

/**
 * The full decision, with its reasoning. `chooseBotMoveElite` is the thin wrapper.
 *
 * options:
 *   omniscient  read opponents' real hands (default true — local bot games)
 *   depth       look-ahead depth (default SEARCH_DEPTH, which is 0 — see above)
 *   debug       attach the per-candidate trace
 */
export function decideMove(state, seat, options = {}) {
  const { omniscient = true, depth = SEARCH_DEPTH, debug = false, features = DEFAULT_FEATURES } = options
  const hand = state.hands[seat] ?? []
  if (!hand.length) return { move: null, score: 0, debug: null }

  const view = observeGame(state, seat, { omniscient })
  const threats = rankThreats(state, seat, view)
  const mine = handPlan(hand)
  const phase = phaseOf(state, seat, threats)

  const all = generateCandidates(state, seat, features)
  const plays = all.filter((m) => m.cards)
  const done = (m, why) => ({
    move: m.cards,
    score: 0,
    debug: debug ? trace(state, seat, mine, threats, phase, [{ ...m, cost: 0, why: [why] }], m) : null,
  })

  // WIN NOW — the hand goes out in one play. Nothing else can be worth more.
  const finisher = plays.find((m) => m.cards.length === hand.length)
  if (finisher) return done(finisher, 'empties the hand — wins the place outright')

  // BLOCK — someone is one or two cards from out, so stop conserving. A bomb on
  // their 2 is the strongest thing in the game; otherwise beat with real weight,
  // since a minimal beat just gets re-beaten and hands them the lead back.
  if (phase === 'BLOCK' && state.current && plays.length) {
    const bombs = plays.filter((m) => bombCut(m.play, state.current, features))
    const pick = bombs.length
      ? bombs.sort((a, b) => topValue(a.cards) - topValue(b.cards) || sortKey(a).localeCompare(sortKey(b)))[0]
      : plays.sort((a, b) => topValue(b.cards) - topValue(a.cards) || sortKey(a).localeCompare(sortKey(b)))[0]
    return done(pick, bombs.length ? 'bombs the 2 that would end the game' : 'blocks the player about to go out')
  }

  // ENDGAME — few enough cards that going out fast beats holding anything back.
  if (phase === 'ENDGAME' && plays.length) {
    const clearing = plays.filter((m) => m.cards.length === hand.length)
    if (clearing.length) return done(clearing.sort((a, b) => topValue(a.cards) - topValue(b.cards))[0], 'clears the hand')
  }

  // NORMAL — conserve. Two rules carry most of the strength here:
  //   · Following, a bomb is never spent: if bombs are the only answer, pass and
  //     keep them for a block (measured worth ~0.05 places on its own).
  //   · Otherwise TAKE the trick. Passing when a normal beat exists gives away a
  //     shed for nothing, and it was the single biggest loss in this bot's first
  //     version — it passed 66% of the time and finished below chance.
  let pool = plays
  if (state.current) {
    const normals = plays.filter((m) => !bombCut(m.play, state.current, features))
    if (!normals.length) {
      const passMove = all.find((m) => !m.cards)
      return done(passMove ?? { cards: null, play: null }, 'only a bomb could answer — keep it for a block')
    }
    pool = normals
  }

  const scored = pool
    .map((m) => ({ ...m, cost: moveCost(state, seat, m, view, features) }))
    .filter((m) => m.cost < Infinity)
  if (!scored.length) return { move: null, score: 0, debug: null }

  // Optional look-ahead, off by default (see SEARCH_DEPTH). When on it re-ranks only
  // the shortlist the cheap score already liked.
  if (depth > 0) {
    const shortlist = scored.sort((a, b) => a.cost - b.cost).slice(0, CANDIDATES_ROOT)
    for (const m of shortlist) {
      const after = applyMine(state, seat, m.cards)
      const next = rollForward(after, seat)
      m.lookahead =
        next.phase === 'over' || next.finished[seat]
          ? evaluatePosition(next, seat, view)
          : bestValue(next, seat, view, depth - 1, features)
      m.cost = -m.lookahead
    }
    shortlist.sort((a, b) => a.cost - b.cost || sortKey(a).localeCompare(sortKey(b)))
    const top = shortlist[0]
    return { move: top.cards, score: -top.cost, debug: debug ? trace(state, seat, mine, threats, phase, shortlist, top) : null }
  }

  scored.sort((a, b) => a.cost - b.cost || sortKey(a).localeCompare(sortKey(b)))
  for (const m of scored) m.why = explain(state, seat, m, mine, view, features)
  const chosen = scored[0]
  return {
    move: chosen.cards,
    score: -chosen.cost,
    debug: debug ? trace(state, seat, mine, threats, phase, scored, chosen) : null,
  }
}

function explain(state, seat, m, mine, view, features) {
  const why = []
  if (!m.cards) return ['passes']
  const after = applyMine(state, seat, m.cards)
  const plan = handPlan(after.hands[seat])
  const breaks = breakCost(mine.melds, m.cards)
  why.push(breaks === 0 ? 'plays whole melds — breaks nothing' : `breaks ${breaks} combination${breaks > 1 ? 's' : ''}`)
  why.push(`turns ${mine.effectiveTurns.toFixed(1)} → ${plan.effectiveTurns.toFixed(1)}`)
  if (isUnanswerable(state, seat, m.play, view, features)) why.push('nobody can answer it — keeps the lead')
  if (plan.bombs < mine.bombs) why.push('spends a bomb')
  return why
}

function trace(state, seat, mine, threats, phase, scored, chosen) {
  return {
    seat,
    phase,
    hand: state.hands[seat].map((c) => c.id),
    turnsToEmpty: Math.round(mine.effectiveTurns * 10) / 10,
    reserves: { twos: mine.twos, bombs: mine.bombs, deadSingles: mine.deadSingles },
    table: state.current ? `${state.current.type} ${state.current.top.id}` : '(my lead)',
    threats: threats.map((t) => ({ seat: t.seat, cards: t.count, turns: Math.round(t.effectiveTurns * 10) / 10, known: t.known })),
    candidates: scored.slice(0, 10).map((m) => ({
      move: m.cards ? m.cards.map((c) => c.id).join(' ') : 'PASS',
      cost: Math.round((m.cost ?? 0) * 100) / 100,
      why: m.why ?? [],
    })),
    decision: chosen.cards ? chosen.cards.map((c) => c.id).join(' ') : 'PASS',
  }
}

/** Log the reasoning for one decision. Off by default — this is a tuning tool. */
export function explainBotMove(state, seat, options = {}) {
  return decideMove(state, seat, { ...options, debug: true }).debug
}

export function formatDecision(d) {
  if (!d) return '(no decision)'
  const lines = [
    `BOT DECISION — seat ${d.seat}   [${d.phase}]`,
    `Hand (${d.hand.length}): ${d.hand.join(' ')}`,
    `Table: ${d.table}`,
    `Turns to empty: ${d.turnsToEmpty}   reserves: ${d.reserves.twos}x2s ${d.reserves.bombs} bombs, ${d.reserves.deadSingles} dead singles`,
    `Threats: ${d.threats.map((t) => `seat ${t.seat} ${t.cards}c/${t.turns}t${t.known ? '' : '?'}`).join('  ')}`,
    '',
    'Candidates (cost in turns, lower is better):',
  ]
  for (const c of d.candidates) {
    lines.push(`  ${String(c.cost).padStart(7)}  ${c.move}`)
    for (const w of c.why) lines.push(`             - ${w}`)
  }
  lines.push('', `Decision: ${d.decision}`)
  return lines.join('\n')
}

/**
 * Elite move for `seat` from the FULL game state. Returns the cards to play, or
 * null to pass (only legal while following).
 *
 * Unlike chooseBotMove/chooseBotMovePro this takes the whole state, because the
 * strategy needs the race — opponents' hands, the played pile, who is about to go
 * out. Both older bots are untouched and still work.
 */
export function chooseBotMoveElite(state, seat, options = {}) {
  if (state.phase !== 'playing' || state.currentPlayer !== seat) return null
  return decideMove(state, seat, options).move
}
