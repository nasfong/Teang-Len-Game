// Elite-bot verification: `node src/games/teanglen/verify-ai.mjs`
//
// Deterministic scenarios (fixed hands, no shuffle) that pin the STRATEGIC
// behaviour, plus a head-to-head soak against the older bots. Add `--debug` to
// print the AI's reasoning for every scenario.
//
// These assert intent, not exact cards: "don't break the straight", "block the
// player about to go out". Retuning WEIGHTS should keep them all green.

import { classify, canBeat, playsOfType, chooseBotMove, chooseBotMovePro } from './engine.js'
import { createMatch, applyPlay, applySkip } from './match.js'
import { chooseBotMoveElite, decideMove, handPlan, breakCost, explainBotMove, formatDecision } from './ai.js'

const DEBUG = process.argv.includes('--debug')
const C = (rank, suit) => ({ rank, suit, id: `${rank}-${suit}` })
const cards = (spec) => spec.split(' ').map((t) => C(t.slice(0, -1), { S: 'spades', C: 'clubs', D: 'diamonds', H: 'hearts' }[t.slice(-1)]))
const ids = (cs) => (cs ? cs.map((c) => c.id).join(' ') : 'PASS')

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** A game state with hand-picked hands. `table` is the play on the table, owned by
 *  `tableOwner`; the seat to act is `turn`. */
function scenario({ hands, turn = 0, table = null, tableOwner = 1 }) {
  const seats = hands.map((_, i) => ({ playerId: `p${i}`, name: `P${i}` }))
  const s = createMatch(seats)
  s.hands = hands
  s.current = table ? classify(table) : null
  s.lastPlayer = table ? tableOwner : turn
  s.currentPlayer = turn
  s.skipped = seats.map(() => false)
  return s
}

const show = (state, seat) => {
  if (DEBUG) console.log(formatDecision(explainBotMove(state, seat)))
}

// ── Rules: fulu ──────────────────────────────────────────────────────────────
// A full house is a triple + a pair on ADJACENT ranks, either way round, no 2.
console.log('\n0. Rules — fulu (full house)')
{
  const type = (spec) => classify(cards(spec))?.type ?? null
  check('333 + 44 is a fulu', type('3S 3H 3C 4D 4S') === 'full_house')
  check('444 + 55 is a fulu', type('4S 4H 4C 5D 5S') === 'full_house')
  check('JJJ + QQ is a fulu', type('JS JH JC QD QS') === 'full_house')
  check('pair BELOW the triple counts (44 + 555)', type('4S 4H 5C 5D 5S') === 'full_house')
  check('555 + KK is NOT a fulu (cross)', type('5S 5H 5C KD KS') === null)
  check('333 + 55 is NOT a fulu (gap)', type('3S 3H 3C 5D 5S') === null)
  check('AAA + 22 is NOT a fulu (2s excluded)', type('AS AH AC 2D 2S') === null)
  check('222 + AA is NOT a fulu (2s excluded)', type('2S 2H 2C AD AS') === null)

  const fulu = (spec) => classify(cards(spec))
  check('higher triple beats lower', canBeat(fulu('5S 5H 5C 6D 6S'), fulu('4S 4H 4C 5D 5S')))
  check('same triple, higher pair wins', canBeat(fulu('5S 5H 5C 6D 6S'), fulu('5D 5C 5H 4D 4S')))
  check('lower triple does not beat', !canBeat(fulu('4S 4H 4C 5D 5S'), fulu('5S 5H 5C 6D 6S')))

  // The enumerator must not offer what the classifier rejects.
  const offered = playsOfType(cards('5S 5H 5C KD KS 6C 6D'), 'full_house', 5)
  check('enumerator offers only legal fulus', offered.every((cs) => classify(cs)?.type === 'full_house'), `${offered.length} offered`)
  check('enumerator finds the adjacent one', offered.length === 1, `${offered.length}`)
}

// ── A — don't break a combination ────────────────────────────────────────────
console.log('\nA. Preserve combinations')
{
  // 5-6-7-8 is a straight worth keeping; K is the natural single to shed.
  const s = scenario({
    hands: [cards('5S 6H 7C 8D KS'), cards('9S 10H JC QD 3S 4H'), cards('3C 4D 5H 6S 7H 8C'), cards('9C 10D JH QS 2C 2D')],
    turn: 0,
  })
  const move = chooseBotMoveElite(s, 0)
  show(s, 0)
  const straight = new Set(['5-spades', '6-hearts', '7-clubs', '8-diamonds'])
  const brokeStraight = move && move.length < 4 && move.some((c) => straight.has(c.id))
  check('leads without splitting 5-6-7-8', !brokeStraight, `played ${ids(move)}`)

  // The same idea in the primitive: breaking the run costs, playing it whole doesn't.
  const plan = handPlan(cards('5S 6H 7C 8D KS'))
  check('breakCost: whole straight = 0', breakCost(plan.melds, cards('5S 6H 7C 8D')) === 0)
  check('breakCost: one card out of it = 1', breakCost(plan.melds, cards('5S')) === 1)
}
{
  // A REAL pair here: 9-9 can't be absorbed into a straight (no 10 or 8), so the
  // loose 4 is the thing to shed. An earlier version of this test used 9S 9H 10C JD,
  // where decompose legitimately reads 9-10-J as a straight and leading a lone 9 is
  // correct — the scenario has to make the pair the only reading.
  const s = scenario({
    hands: [cards('9S 9H 4C QD'), cards('3S 4H 5C 6D 7S'), cards('QC KD AH 2S 3H'), cards('8S 8H 8C 7D 6H')],
    turn: 0,
  })
  const move = chooseBotMoveElite(s, 0)
  show(s, 0)
  const splitPair = move && move.length === 1 && move[0].rank === '9'
  check('does not split the pair of 9s to lead', !splitPair, `played ${ids(move)}`)
}

// ── B — an opponent is one card from out ─────────────────────────────────────
console.log('\nB. Opponent about to finish')
{
  // Seat 1 holds a lone 5 and leads it. Passing hands them the game.
  const s = scenario({
    hands: [cards('AS 2H'), cards('5D'), cards('3S 4H 6C 7D 8S'), cards('9C 10D JH QS')],
    turn: 0,
    table: cards('5D'),
    tableOwner: 1,
  })
  const move = chooseBotMoveElite(s, 0)
  show(s, 0)
  check('beats the last card instead of passing', move !== null, `played ${ids(move)}`)
}
{
  // Same shape but nobody is close: keeping A/2 is fine.
  const s = scenario({
    hands: [cards('AS 2H'), cards('5D 6S 7H 8C 9D 10S JC'), cards('3S 4H 6C 7D 8S 9H'), cards('9C 10D JH QS KC AD')],
    turn: 0,
    table: cards('5D'),
    tableOwner: 1,
  })
  const d = decideMove(s, 0, { debug: true })
  show(s, 0)
  check('with 2 cards left it still races (does not stall)', d.move !== null || d.debug.candidates.length > 0)
}

// ── C — bomb conservation ────────────────────────────────────────────────────
console.log('\nC. Bomb management')
{
  // Calm table: a quad over a lone 2 is legal but wasteful.
  const s = scenario({
    hands: [cards('7S 7H 7C 7D 3S 4H 5C'), cards('2S 9H 10C JD QS KH AC'), cards('3C 4D 5H 6S 8H 9C 10D'), cards('JS QC KD AH 6C 8S 9S')],
    turn: 0,
    table: cards('2S'),
    tableOwner: 1,
  })
  const move = chooseBotMoveElite(s, 0)
  show(s, 0)
  check('holds the bomb when nobody is close to out', move === null, `played ${ids(move)}`)
}
{
  // Seat 1 is on their LAST card and it's a 2 — the bomb is exactly what it's for.
  const s = scenario({
    hands: [cards('7S 7H 7C 7D 3S'), cards('2S'), cards('3C 4D 5H 6S 8H'), cards('JS QC KD AH 6C')],
    turn: 0,
    table: cards('2S'),
    tableOwner: 1,
  })
  const move = chooseBotMoveElite(s, 0)
  show(s, 0)
  check('bombs the 2 that would win the game', move !== null && move.length === 4, `played ${ids(move)}`)
}

// ── D — placement race ───────────────────────────────────────────────────────
console.log('\nD. Racing for a place')
{
  const s = scenario({
    hands: [cards('3S 4H 5C 9D'), cards('2H'), cards('6S 7H 8C 9S 10H JC QD KS'), cards('3C 4D 5H 6C 7D 8S 9H 10C')],
    turn: 0,
  })
  const d = decideMove(s, 0, { debug: true })
  show(s, 0)
  check('leads something (never stalls on a lead)', d.move !== null)
  check('sheds the 3-4-5 run rather than the loose 9', d.move.length === 3, `played ${ids(d.move)}`)
}

// ── E — don't throw strong cards away ────────────────────────────────────────
console.log('\nE. Spend weak before strong')
{
  const s = scenario({
    hands: [cards('3S 4H 5C 6D 7S AH 2C'), cards('8S 9H 10C JD QS KH 3D'), cards('4C 5D 6H 7C 8D 9S 10H'), cards('JC QD KS AC 2D 2H 3C')],
    turn: 0,
  })
  const move = chooseBotMoveElite(s, 0)
  show(s, 0)
  const spentPower = move.some((c) => c.rank === '2' || c.rank === 'A')
  check('does not open with the A or the 2', !spentPower, `played ${ids(move)}`)
}

// ── determinism ──────────────────────────────────────────────────────────────
console.log('\nF. Determinism')
{
  const build = () =>
    scenario({
      hands: [cards('3S 4H 5C 6D 7S AH 2C'), cards('8S 9H 10C JD QS KH 3D'), cards('4C 5D 6H 7C 8D 9S 10H'), cards('JC QD KS AC 2D 2H 3C')],
      turn: 0,
    })
  const a = ids(chooseBotMoveElite(build(), 0))
  const b = ids(chooseBotMoveElite(build(), 0))
  check('same state → same move', a === b, `${a} vs ${b}`)
}

// ── legality soak + head-to-head ─────────────────────────────────────────────
console.log('\nG. Soak: legality, termination, strength')
{
  // Seeded shuffle so the soak is reproducible run to run.
  let seed = 20260809
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
  const SUITS = ['spades', 'clubs', 'diamonds', 'hearts']
  const dealSeeded = () => {
    const deck = RANKS.flatMap((r) => SUITS.map((s) => C(r, s)))
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    return [0, 1, 2, 3].map((k) => deck.slice(k * 13, k * 13 + 13))
  }

  // A/B on IDENTICAL deals: the hero seat plays elite in one run and pro in the
  // other, with pro in every other seat both times. Same cards, same opener, so the
  // only variable is the hero's policy. Anything less than this can't tell a real
  // gain from a lucky shuffle.
  const GAMES = 200
  const table = Array.from({ length: GAMES }, () => dealSeeded())
  const pro = (s, seat) => {
    const counts = s.hands.map((h) => h.length).filter((len, i) => i !== seat && len > 0)
    return chooseBotMovePro(s.hands[seat], s.current, { opponentCounts: counts })
  }

  let illegal = 0
  let stalled = 0
  const play = (heroPolicy) => {
    const places = [0, 0, 0, 0]
    for (let g = 0; g < GAMES; g++) {
      const hero = g % 4
      let s = scenario({ hands: table[g].map((h) => [...h]), turn: hero })
      let turns = 0
      while (s.phase === 'playing' && turns++ < 800) {
        const seat = s.currentPlayer
        const move = seat === hero ? heroPolicy(s, seat) : pro(s, seat)
        const res = move ? applyPlay(s, seat, move) : applySkip(s, seat)
        if (res.error) {
          illegal++
          break
        }
        s = res.state
      }
      if (s.phase !== 'over') stalled++
      else {
        const place = s.ranked.indexOf(hero) + 1
        if (place > 0) places[place - 1]++
      }
    }
    const n = places.reduce((a, c) => a + c, 0)
    return { places, mean: places.reduce((a, c, i) => a + c * (i + 1), 0) / Math.max(1, n), n }
  }

  const t0 = Date.now()
  const elite = play((s, seat) => chooseBotMoveElite(s, seat))
  const ms = Date.now() - t0
  const base = play(pro)
  const greedy = play((s, seat) => chooseBotMove(s.hands[seat], s.current))

  const line = (label, r) =>
    console.log(`     ${label.padEnd(7)} 1st ${String(r.places[0]).padStart(3)}  2nd ${String(r.places[1]).padStart(3)}  3rd ${String(r.places[2]).padStart(3)}  4th ${String(r.places[3]).padStart(3)}   mean ${r.mean.toFixed(3)}`)
  console.log(`     ${GAMES} identical deals, hero seat rotated; lower mean is better`)
  line('elite', elite)
  line('pro', base)
  line('greedy', greedy)
  console.log(`     elite cost ${ms}ms for ${GAMES} games (~${Math.round((ms / GAMES) * 10) / 10}ms/game)`)

  check('every elite move was legal', illegal === 0, `${illegal} rejected`)
  check('every game terminated', stalled === 0, `${stalled} stalled`)
  check('decisively beats the greedy bot', greedy.mean - elite.mean > 0.4, `${elite.mean.toFixed(3)} vs ${greedy.mean.toFixed(3)}`)
  // Elite vs pro is a TIE, and this asserts the tie rather than pretending otherwise.
  // Measured over 2000 paired deals the difference is -0.012 ± 0.039 places (95% CI):
  // not distinguishable from zero. 200 deals here has a standard error near 0.075, so
  // a "beats pro" assertion would pass or fail on the shuffle, not on the bot. Widen
  // the sample before believing any change to this margin.
  check('is not worse than the pro bot', elite.mean < base.mean + 0.15, `${elite.mean.toFixed(3)} vs ${base.mean.toFixed(3)}`)
}

console.log(`\n${fail === 0 ? '✅' : '❌'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
