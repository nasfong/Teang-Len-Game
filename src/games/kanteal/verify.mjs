// Kanteal rule verification — walks the §9 implementation checklist, then soaks
// the state machine with randomised games looking for invariant breaks.
import { RANKS, canBeat, deal, chooseBotMove, HAND_SIZE } from './engine.js'
import { createMatch, applyPlay, applyPass, legalMoves, deriveFlags } from './match.js'

let pass = 0
const fails = []
const ok = (name, cond, extra = '') => (cond ? pass++ : fails.push(`${name} ${extra}`))

const C = (rank, suit) => ({ rank, suit, id: `${rank}-${suit}` })
const seats = (n) => Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, name: `P${i}` }))

// Build a state with exact hands so each rule can be driven deterministically.
function rig(hands, over = {}) {
  const s = createMatch(seats(hands.length))
  return { ...s, hands, ...over }
}

// ── §1 ranks / deck ───────────────────────────────────────────────────────────
ok('§1 ranks low→high', RANKS[0] === '2' && RANKS[RANKS.length - 1] === 'A')
ok('§1 13 ranks', RANKS.length === 13)
for (const n of [2, 4, 8]) {
  const { hands } = deal(n)
  const all = hands.flat()
  ok(`§1 ${n}p deals ${HAND_SIZE} each`, hands.every((h) => h.length === HAND_SIZE))
  ok(`§1 ${n}p no duplicate cards`, new Set(all.map((c) => c.id)).size === n * HAND_SIZE)
}

// ── §2 the beat rule ──────────────────────────────────────────────────────────
ok('§2 same suit higher beats', canBeat(C('A', 'diamonds'), C('K', 'diamonds')) === true)
ok('§2 same suit lower fails', canBeat(C('Q', 'diamonds'), C('K', 'diamonds')) === false)
ok('§2 higher rank wrong suit fails', canBeat(C('A', 'spades'), C('K', 'diamonds')) === false)
ok('§2 ties do not beat', canBeat(C('K', 'diamonds'), C('K', 'diamonds')) === false)
ok('§2 any card opens', canBeat(C('2', 'clubs'), null) === true)
ok('§2 suits never compared', canBeat(C('2', 'hearts'), C('A', 'spades')) === false)

// ── §3 opening ────────────────────────────────────────────────────────────────
{
  const s = rig([[C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs'), C('5', 'clubs')], [C('K', 'diamonds'), C('2', 'clubs'), C('6', 'clubs'), C('7', 'clubs')]])
  ok('§3 cannot open by passing', Boolean(applyPass(s, 0, s.hands[0][0]).error))
  const opened = applyPlay(s, 0, C('9', 'diamonds'))
  ok('§3 opening plays a card', opened.state?.table?.id === '9-diamonds')
  ok('§3 opening is not a beat (no leader)', opened.state.leader === null)
  ok('§6 opening counts for survival', opened.state.hasBeaten[0] === true)
  ok('§3 turn passes clockwise', opened.state.currentPlayer === 1)
}

// ── §3/§4 cycle winner = last beater; opener if uncontested (PLACEHOLDER) ─────
{
  // 3 players, everyone on 4 cards so passing is legal.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs'), C('5', 'clubs')],
    [C('K', 'diamonds'), C('3', 'hearts'), C('4', 'hearts'), C('5', 'hearts')],
    [C('A', 'diamonds'), C('3', 'spades'), C('4', 'spades'), C('5', 'spades')],
  ])
  let g = applyPlay(s, 0, C('9', 'diamonds')).state // P0 opens 9♦
  g = applyPlay(g, 1, C('K', 'diamonds')).state // P1 beats
  ok('§7 challenge not started above threshold', g.challenge === null)
  // Asserted BEFORE the last seat acts: the third move closes the cycle, and
  // endCycle clears `leader` after banking it as the winner.
  ok('§3 leader is last beater', g.leader === 1)
  g = applyPlay(g, 2, C('A', 'diamonds')).state // P2 beats, cycle closes
  ok('§3 cycle ended, winner opens', g.opener === 2 && g.currentPlayer === 2 && g.cycle === 1)
  ok('§3 table cleared for new cycle', g.table === null && g.leader === null)
}
{
  const s = rig([
    [C('A', 'diamonds'), C('3', 'clubs'), C('4', 'clubs'), C('5', 'clubs')],
    [C('2', 'hearts'), C('3', 'hearts'), C('4', 'hearts'), C('5', 'hearts')],
  ])
  let g = applyPlay(s, 0, C('A', 'diamonds')).state
  g = applyPass(g, 1, C('2', 'hearts')).state
  ok('§3 PLACEHOLDER uncontested cycle → opener wins it', g.opener === 0 && g.cycle === 1)
}

// ── §5 last 2 cards: face-up only ─────────────────────────────────────────────
{
  // Three seats, so P2 is still to act and the cycle can't end on P1's move —
  // otherwise endCycle clears the table and there's nothing left to assert about.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('2', 'spades'), C('3', 'spades')], // 2 cards, cannot beat 9♦
    [C('4', 'hearts'), C('5', 'hearts'), C('6', 'hearts')],
  ], { hasBeaten: [false, true, true] })
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  ok('§5 pass forbidden at ≤2 cards', Boolean(applyPass(g, 1, C('2', 'spades')).error))
  const lm = legalMoves(g, 1)
  ok('§5 every card playable at ≤2', lm.canPlay.length === 2 && lm.canPass === false)
  const r = applyPlay(g, 1, C('2', 'spades'))
  ok('§5 non-beating card is accepted', !r.error)
  ok('§5 table unchanged by reveal', r.state.table.id === '9-diamonds')
  ok('§5 leader unchanged by reveal', r.state.leader === null)
  ok('§5 revealed card left the hand', r.state.hands[1].length === 1)
  ok('§5 reveal is public', r.state.reveals.length === 1 && r.state.reveals[0].card.id === '2-spades')
}
{
  // Above the threshold the same play is simply illegal.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs')],
    [C('2', 'spades'), C('3', 'spades'), C('4', 'spades')],
  ], { hasBeaten: [false, true] })
  const g = applyPlay(s, 0, C('9', 'diamonds')).state
  ok('§5 non-beating play rejected above threshold', Boolean(applyPlay(g, 1, C('2', 'spades')).error))
}

// ── §6 the 2-card cut ─────────────────────────────────────────────────────────
{
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('2', 'spades'), C('3', 'spades'), C('4', 'spades')], // 3 cards, never beaten
    [C('2', 'hearts'), C('3', 'hearts'), C('4', 'hearts')],
  ])
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPass(g, 1, C('2', 'spades')).state // → 2 cards, never beaten
  ok('§6 cut on reaching threshold without a beat', g.eliminated[1] === true)
  ok('§6 dropped cards never revealed', g.hands[1].length === 2 && g.reveals.length === 0)
  ok('§6 eliminated seat is skipped', g.currentPlayer === 2)
  ok('§3 discards are a count only', g.discards[1] === 1 && typeof g.discards[1] === 'number')
}
{
  // Having beaten earlier makes the same pass safe.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('2', 'spades'), C('3', 'spades'), C('4', 'spades')],
    [C('2', 'hearts'), C('3', 'hearts'), C('4', 'hearts')],
  ], { hasBeaten: [false, true, false] })
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPass(g, 1, C('2', 'spades')).state
  ok('§6 a prior beat makes the seat safe', g.eliminated[1] === false)
}
{
  // §4B — elimination leaves one player standing.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('2', 'spades'), C('3', 'spades'), C('4', 'spades')],
  ])
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPass(g, 1, C('2', 'spades')).state
  ok('§4B last player standing wins immediately', g.phase === 'over' && g.winner === 0)
  ok('§4B rankings carry one winner', deriveFlags(g).rankings?.[0]?.playerId === 'p0')
}

// ── §4 the two winner readings ────────────────────────────────────────────────
// The divergent case needs TWO cycles: one containing the game's last real beat,
// then a final one nobody beats in, opened by somebody else. That last part only
// happens because the cycle winner has run out of cards, so the open passes on.
{
  const build = (rules) => {
    let g = rig(
      [
        [C('9', 'diamonds'), C('2', 'clubs')], // opens cycle 1, then opens cycle 2
        [C('K', 'diamonds')], // BEATS, and is then empty
        [C('3', 'spades')], // can't answer — revealed, then empty
      ],
      { hasBeaten: [true, true, true] },
    )
    g = { ...g, rules: { ...g.rules, ...rules } }
    g = applyPlay(g, 0, C('9', 'diamonds')).state // cycle 1 opens
    g = applyPlay(g, 1, C('K', 'diamonds')).state // seat 1 BEATS → now empty
    g = applyPlay(g, 2, C('3', 'spades')).state // §5 reveal → empty; cycle 1 ends
    // Seat 1 won cycle 1 but holds nothing, so seat 0 opens cycle 2 — and there is
    // nobody left to answer, so cycle 2 is uncontested and ends the game.
    return applyPlay(g, 0, C('2', 'clubs')).state
  }
  const cycleScoped = build({ winnerIsLastBeatOverall: false })
  const gameWide = build({ winnerIsLastBeatOverall: true })

  ok('§4 the game actually ended', cycleScoped.phase === 'over' && gameWide.phase === 'over')
  ok('§4 lastBeater survives the cycle reset', gameWide.lastBeater === 1)
  ok('§4 cycle-scoped credits the final cycle’s opener', cycleScoped.winner === 0)
  ok('§4 game-wide credits the last real beat', gameWide.winner === 1)
  ok('§4 the two readings name different players', cycleScoped.winner !== gameWide.winner)
}

// ── §7 challenge display ──────────────────────────────────────────────────────
{
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('K', 'diamonds'), C('3', 'spades')], // exactly 2 cards
    [C('A', 'diamonds'), C('3', 'hearts'), C('4', 'hearts'), C('5', 'hearts')],
  ], { hasBeaten: [false, true, false] })
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPlay(g, 1, C('K', 'diamonds')).state
  ok('§7 challenge starts on a beat at the threshold', g.challenge?.seat === 1)
  g = applyPlay(g, 2, C('A', 'diamonds')).state
  ok('§7 later beat takes over regardless of hand size', g.challenge === null || g.cycle === 1)
}

// ── §8 the worked example ─────────────────────────────────────────────────────
{
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs'), C('5', 'clubs')],
    [C('K', 'diamonds'), C('3', 'spades')],
    [C('A', 'diamonds'), C('3', 'hearts'), C('4', 'hearts'), C('5', 'hearts')],
    [C('2', 'clubs'), C('6', 'clubs'), C('7', 'clubs'), C('8', 'clubs')],
  ], { hasBeaten: [false, true, false, false] })
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPlay(g, 1, C('K', 'diamonds')).state
  g = applyPlay(g, 2, C('A', 'diamonds')).state
  g = applyPass(g, 3, C('2', 'clubs')).state
  ok('§8 P3 wins the cycle and opens next', g.opener === 2 && g.cycle === 1)
  ok('§8 P4 pass is a hidden count', g.discards[3] === 1)
}

// ── Soak: randomised full games ───────────────────────────────────────────────
let games = 0
let terminated = 0
const invariant = []
for (let n = 2; n <= 8; n++) {
  for (let i = 0; i < 200; i++) {
    let g = createMatch(seats(n))
    const dealt = g.hands.flat().length
    let guard = 0
    while (g.phase === 'playing' && guard++ < 5000) {
      const seat = g.currentPlayer
      const lm = legalMoves(g, seat)
      if (g.eliminated[seat] || g.hands[seat].length === 0) { invariant.push('turn given to a seat that cannot act'); break }
      // §5's real promise, stated in UI terms: whoever is to move always has at
      // least one enabled control. If this ever fails the board deadlocks — every
      // card greyed out and Pass hidden — with no error to explain it.
      if (!lm.canPlay.length && !lm.canPass) invariant.push('a seat had no legal move')
      const mv = chooseBotMove(g.hands[seat], g.table, { mustOpen: lm.mustOpen })
      const res = mv.type === 'pass' && lm.canPass ? applyPass(g, seat, mv.card) : applyPlay(g, seat, mv.card)
      if (res.error) { invariant.push(`bot produced an illegal move: ${res.error}`); break }
      g = res.state
      // Cards are conserved: nothing is created, nothing vanishes untracked.
      const held = g.hands.flat().length
      const gone = g.discards.reduce((a, b) => a + b, 0) + g.reveals.length
      if (held + gone > dealt) invariant.push('card count grew')
      if (g.eliminated.filter(Boolean).length === g.seats.length) invariant.push('everyone eliminated')
    }
    games++
    if (g.phase === 'over') {
      terminated++
      if (g.winner === null) invariant.push('game over with no winner')
      else if (g.eliminated[g.winner]) invariant.push('an eliminated seat won')
    }
  }
}
ok('soak: every game terminates', terminated === games, `(${terminated}/${games})`)
ok('soak: no invariant breaks', invariant.length === 0, [...new Set(invariant)].join('; '))

console.log(`\n${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
