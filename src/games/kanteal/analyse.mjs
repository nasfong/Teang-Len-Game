// Kanteal balance analysis — `node src/games/kanteal/analyse.mjs`
//
// The rule spec raises two open questions about itself, and both are measurable
// rather than arguable:
//
//   §6 "In 4-player games this rule frequently cuts half the table. If that is too
//       harsh, the tuning knobs are the 2-card threshold and whether opening should
//       count."
//   §3 The uncontested-cycle rule is a PLACEHOLDER, and "can decide the whole game,
//       since the game's winner is a cycle winner."
//
// So this sweeps those knobs over many simulated games and reports what each one
// actually does. It is NOT a test — verify.mjs is the correctness check. Nothing
// here asserts; it prints numbers for a human to make a design call with.
//
// Caveat worth keeping in mind when reading the output: every seat is played by
// chooseBotMove, which beats with its weakest legal card and otherwise discards its
// weakest. Real players hold cards back and dump strategically, so treat these as
// the shape of the rules, not a prediction of live play.
import { createMatch, applyPass, applyPlay, legalMoves, DEFAULT_RULES } from './match.js'
import { chooseBotMove, RANKS } from './engine.js'

const GAMES = 4000
const seats = (n) => Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, name: `P${i}` }))

// The bot always beats when it legally can, which makes it maximally elimination-
// AVERSE — beating is exactly what keeps you safe under §6. But passing is legal
// even when you could beat, and a real player hoards: they decline a beat that
// would spend a high card. `hoardAbove` models that — decline any beat whose
// cheapest legal card ranks above this index (RANKS is 0='2' … 12='A'). null = the
// shipped bot. This is the single biggest lever on the elimination rate, so the
// spec's playtested numbers and a bot's are not comparable without it.
function move(g, seat, rules, hoardAbove) {
  const lm = legalMoves(g, seat)
  const mv = chooseBotMove(g.hands[seat], g.table, { mustOpen: lm.mustOpen, faceUpAt: rules.faceUpAt })
  if (!mv || hoardAbove == null || lm.mustOpen || !lm.canPass) return mv
  if (mv.type === 'play' && RANKS.indexOf(mv.card.rank) > hoardAbove) {
    // Hold it back and shed the weakest card instead.
    const weakest = [...g.hands[seat]].sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank))[0]
    return { type: 'pass', card: weakest }
  }
  return mv
}

function playOut(n, rules, hoardAbove = null) {
  let g = createMatch(seats(n), { rules })
  let guard = 0
  // §3's placeholder only decides something when a cycle ENDS with no beat in it.
  // `leader` is cleared by endCycle, so it has to be sampled from the state BEFORE
  // each transition — reading hasBeaten afterwards can't tell us, because opening
  // sets that flag too.
  let uncontestedCycles = 0
  let finalCycleUncontested = false
  // §4's headline is GAME-scoped — "the player who makes the latest successful beat
  // is the winner" — whereas §3.4's cycle winner is CYCLE-scoped. When the final
  // cycle has no beat in it those two readings name different people, so track the
  // last beater across the whole game and see how often they disagree.
  let lastBeaterOverall = null
  while (g.phase === 'playing' && guard++ < 5000) {
    const seat = g.currentPlayer
    const mv = move(g, seat, rules, hoardAbove)
    if (!mv) break
    const lm = legalMoves(g, seat)
    const res = mv.type === 'pass' && lm.canPass ? applyPass(g, seat, mv.card) : applyPlay(g, seat, mv.card)
    if (res.error) break
    const before = g
    g = res.state
    if (g.leader !== null && g.leader !== before.leader) lastBeaterOverall = g.leader
    if (g.cycle !== before.cycle || g.phase === 'over') {
      const contested = before.leader !== null
      if (!contested) uncontestedCycles++
      if (g.phase === 'over') finalCycleUncontested = !contested
    }
  }
  return { g, uncontestedCycles, finalCycleUncontested, lastBeaterOverall }
}

function sample(n, rules, hoardAbove = null, games = GAMES) {
  let cut = 0
  let seatsTotal = 0
  let lastStanding = 0 // §4B — game ended because everyone else was eliminated
  let cycles = 0
  let decidedByPlaceholder = 0 // the FINAL cycle had no beat, so §3's rule named the winner
  let anyUncontested = 0
  let readingsDisagree = 0
  for (let i = 0; i < games; i++) {
    const { g, uncontestedCycles, finalCycleUncontested, lastBeaterOverall } = playOut(n, rules, hoardAbove)
    if (g.winner != null && lastBeaterOverall != null && g.winner !== lastBeaterOverall) readingsDisagree++
    cut += g.eliminated.filter(Boolean).length
    seatsTotal += n
    cycles += g.cycle + 1
    if (g.eliminated.filter((e) => !e).length === 1) lastStanding++
    if (uncontestedCycles > 0) anyUncontested++
    // Only counts when the game ended on a cycle nobody beat in AND it wasn't the
    // §4B lone-survivor path, which names a winner without consulting the cycle.
    if (finalCycleUncontested && g.eliminated.filter((e) => !e).length > 1) decidedByPlaceholder++
  }
  return {
    cutPct: (100 * cut) / seatsTotal,
    lastStandingPct: (100 * lastStanding) / games,
    cycles: cycles / games,
    placeholderPct: (100 * decidedByPlaceholder) / games,
    anyUncontestedPct: (100 * anyUncontested) / games,
    disagreePct: (100 * readingsDisagree) / games,
  }
}

const row = (label, r) =>
  `  ${label.padEnd(22)} ${r.cutPct.toFixed(1).padStart(5)}%  ${r.lastStandingPct.toFixed(1).padStart(5)}%  ${r.cycles.toFixed(1).padStart(5)}`

console.log(`\nKanteal balance — ${GAMES} games per row, all seats played by the bot\n`)

console.log('§6 THE 2-CARD CUT, as shipped (faceUpAt 2, opening counts)')
console.log('  players                  cut   §4B   cycles')
for (const n of [2, 3, 4, 5, 6, 8]) console.log(row(`${n} players`, sample(n, DEFAULT_RULES)))

console.log('\n§6 KNOB 1 — the threshold, at 4 players')
console.log('  faceUpAt                 cut   §4B   cycles')
for (const f of [1, 2, 3]) console.log(row(`${f} card${f === 1 ? '' : 's'}`, sample(4, { ...DEFAULT_RULES, faceUpAt: f })))

console.log('\n§6 KNOB 2 — does opening count as a beat? (4 players)')
console.log('  openingCountsAsBeat      cut   §4B   cycles')
for (const b of [true, false])
  console.log(row(String(b), sample(4, { ...DEFAULT_RULES, openingCountsAsBeat: b })))

console.log('\n§6 HOW MUCH DOES STRATEGY MATTER? (4 players, shipped rules)')
console.log('  A seat that HOARDS declines beats that would spend a high card — which is')
console.log('  exactly how a player gets cut. The bot never does this, so it is the floor.')
console.log('  strategy                 cut   §4B   cycles')
console.log(row('always beat (bot)', sample(4, DEFAULT_RULES, null)))
for (const h of [10, 8, 6, 4])
  console.log(row(`hoard above ${RANKS[h].padEnd(2)}`, sample(4, DEFAULT_RULES, h)))

console.log('\n§3 THE PLACEHOLDER — how often does it actually decide a game?')
console.log('  decided = the FINAL cycle had no beat in it, so the opener took the game')
console.log('  players            decided   any uncontested cycle')
for (const n of [2, 3, 4, 6, 8]) {
  const r = sample(n, DEFAULT_RULES)
  console.log(
    `  ${String(n).padStart(2)} players           ${r.placeholderPct.toFixed(1).padStart(5)}%   ${r.anyUncontestedPct.toFixed(1).padStart(5)}%`,
  )
}

console.log('\n§4 TWO READINGS OF "THE LATEST SUCCESSFUL BEAT"')
console.log('  (both now ship — flip rules.winnerIsLastBeatOverall to switch)')
console.log('  shipped  = winner of the final CYCLE (its opener, when nobody beat)')
console.log('  headline = the last player to beat in the whole GAME')
console.log('  How often do those name different players?')
for (const n of [2, 3, 4, 6, 8]) {
  const r = sample(n, DEFAULT_RULES)
  console.log(`  ${String(n).padStart(2)} players           ${r.disagreePct.toFixed(1).padStart(5)}%`)
}
console.log()
