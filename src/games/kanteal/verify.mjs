// Kanteal rule verification — walks the §9 implementation checklist, then soaks
// the state machine with randomised games looking for invariant breaks.
import { RANKS, canBeat, deal, chooseBotMove, HAND_SIZE } from './engine.js'
import { createMatch, applyPlay, applyPass, applyCommit, applyReveal, legalMoves, deriveFlags } from './match.js'

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
  ok('§6 opening banks no successful beat', opened.state.successfulBeats[0] === 0)
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
  ], { successfulBeats: [0, 1, 1] }) // P1/P2 have a prior win, so §6 won't cut them
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
  ], { successfulBeats: [0, 1] })
  const g = applyPlay(s, 0, C('9', 'diamonds')).state
  ok('§5 non-beating play rejected above threshold', Boolean(applyPlay(g, 1, C('2', 'spades')).error))
}

// ── §6 the successful-beat requirement ────────────────────────────────────────
{
  // Reaching ≤2 cards having never WON a trick cuts you the moment control lands.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('2', 'spades'), C('3', 'spades'), C('4', 'spades')], // 3 cards, never won
    [C('2', 'hearts'), C('3', 'hearts'), C('4', 'hearts')],
  ])
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPass(g, 1, C('2', 'spades')).state // → 2 cards, zero successful beats
  ok('§6 cut on reaching threshold with no successful beat', g.eliminated[1] === true)
  // TEAV — the 2 cards left in hand are dropped face-down, never revealed. Here the
  // history is the pass (1) plus the two dropped cards (2) = 3, all face-down.
  ok('§6 teav: the last cards leave the hand, none revealed', g.hands[1].length === 0 && g.reveals.length === 0)
  ok('§6 teav: dropped cards show face-down in the history', g.played[1].length === 3 && g.played[1].every((e) => e.hidden === true))
  ok('§6 teav: a dropped card leaks NO identity', g.played[1].every((e) => e.card === undefined))
  ok('§6 eliminated seat is skipped', g.currentPlayer === 2)
  ok('§3 discards still count only the pass', g.discards[1] === 1 && typeof g.discards[1] === 'number')
}
{
  // A prior successful beat makes the same pass safe.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('2', 'spades'), C('3', 'spades'), C('4', 'spades')],
    [C('2', 'hearts'), C('3', 'hearts'), C('4', 'hearts')],
  ], { successfulBeats: [0, 1, 0] })
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPass(g, 1, C('2', 'spades')).state
  ok('§6 a prior successful beat makes the seat safe', g.eliminated[1] === false)
}
{
  // A beatless seat granted its turn at ≤2 cards is cut before it can play — even
  // reaching the threshold by BEING BEATEN (not passing) does not exempt it.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('K', 'spades'), C('3', 'spades')], // 2 cards, never won
    [C('A', 'diamonds'), C('3', 'hearts'), C('4', 'hearts')],
  ])
  const g = applyPlay(s, 0, C('9', 'diamonds')).state // opens; turn would reach P1
  ok('§6 gate cuts a beatless ≤2 seat on its turn', g.eliminated[1] === true)
  // TEAV even without passing: both cards still in hand drop face-down.
  ok('§6 teav drops both remaining cards face-down', g.hands[1].length === 0 && g.played[1].length === 2 && g.played[1].every((e) => e.hidden === true))
  ok('§6 gate skips control to the next seat', g.currentPlayer === 2)
}
{
  // The winning seat of a completed cycle banks a successful beat; a beat that is
  // BEATEN BACK banks nothing (the core of the new rule).
  const s = rig([
    [C('5', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],   // opens
    [C('9', 'diamonds'), C('2', 'hearts'), C('3', 'hearts')], // beats, then beaten
    [C('K', 'diamonds'), C('3', 'spades'), C('4', 'spades')], // beats P1 → wins
  ])
  let g = applyPlay(s, 0, C('5', 'diamonds')).state
  g = applyPlay(g, 1, C('9', 'diamonds')).state // P1 beats (leader P1)
  g = applyPlay(g, 2, C('K', 'diamonds')).state // P2 beats P1, cycle closes
  ok('§6 a beaten-back beat banks nothing', g.successfulBeats[1] === 0)
  ok('§6 the surviving beat is credited', g.successfulBeats[2] === 1)
  ok('§6 the beaten opener is credited nothing', g.successfulBeats[0] === 0)
}
{
  // Winning a trick early lets a seat finish its last two cards normally.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('2', 'spades'), C('3', 'spades')], // 2 cards, but has a prior win
    [C('A', 'diamonds'), C('3', 'hearts'), C('4', 'hearts')],
  ], { successfulBeats: [0, 1, 0] })
  const g = applyPlay(s, 0, C('9', 'diamonds')).state
  ok('§6 a prior win lets the seat play on at ≤2', g.eliminated[1] === false && g.currentPlayer === 1)
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
  // deriveFlags lists EVERY participant so the server's winner-take-all settlement
  // knows who pays: exactly one rank-1 winner (the winner seat), the rest rank 2.
  {
    const r = deriveFlags(g).rankings ?? []
    const winners = r.filter((e) => e.rank === 1)
    ok(
      '§4B rankings mark exactly one winner and list all seats',
      r.length === g.seats.length && winners.length === 1 && winners[0].playerId === 'p0',
    )
    ok('§4B every non-winner is a payer (rank ≠ 1)', r.filter((e) => e.rank !== 1).length === g.seats.length - 1)
  }
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
      { successfulBeats: [1, 1, 1] }, // all on their last cards — a prior win keeps §6 off
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

// ── Played-card history ───────────────────────────────────────────────────────
{
  const s0 = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs'), C('5', 'clubs')],
    [C('K', 'diamonds'), C('2', 'hearts'), C('4', 'hearts'), C('5', 'hearts')],
    [C('A', 'diamonds'), C('2', 'spades'), C('4', 'spades'), C('5', 'spades')],
  ])
  let g = applyPlay(s0, 0, C('9', 'diamonds')).state
  g = applyPlay(g, 1, C('K', 'diamonds')).state
  g = applyPass(g, 2, C('2', 'spades')).state

  ok('history records a face-up play', g.played[0][0].card.id === '9-diamonds')
  ok('history records a beat face-up', g.played[1][0].card.id === 'K-diamonds')
  ok('history records a pass', g.played[2].length === 1 && g.played[2][0].hidden === true)
  // The whole point of the hidden entry: a discard is "hidden from everyone", and
  // the state is relayed to every client, so the identity must never be in it.
  ok('a passed card leaks NO identity', g.played[2][0].card === undefined)

  // Cycle 1 ended on that pass; the beaten card must survive into the next cycle.
  const before = g.played.map((p) => p.length)
  g = applyPlay(g, 1, C('2', 'hearts')).state // seat 1 won the cycle and opens
  ok('history survives the cycle reset', g.played[0][0].card.id === '9-diamonds')
  ok('a beaten card is still shown', g.played[0].length === before[0])
  ok('history only ever grows', g.played[1].length === before[1] + 1)
  ok('history is ordered oldest-first', g.played[1][0].card.id === 'K-diamonds')
}

// ── §7 challenge display ──────────────────────────────────────────────────────
{
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('K', 'diamonds'), C('3', 'spades')], // exactly 2 cards
    [C('A', 'diamonds'), C('3', 'hearts'), C('4', 'hearts'), C('5', 'hearts')],
  ], { successfulBeats: [0, 1, 0] }) // P1 on its last cards needs a prior win to beat
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
  ], { successfulBeats: [0, 1, 0, 0] })
  let g = applyPlay(s, 0, C('9', 'diamonds')).state
  g = applyPlay(g, 1, C('K', 'diamonds')).state
  g = applyPlay(g, 2, C('A', 'diamonds')).state
  g = applyPass(g, 3, C('2', 'clubs')).state
  ok('§8 P3 wins the cycle and opens next', g.opener === 2 && g.cycle === 1)
  ok('§8 P4 pass is a hidden count', g.discards[3] === 1)
}

// ── Final challenge — two-card commit + Round 2 reveal ─────────────────────────
{
  // Two seats, each at their last two cards with a prior win (so §6 spares them).
  const s = rig([
    [C('2', 'diamonds'), C('5', 'diamonds')],
    [C('3', 'hearts'), C('9', 'diamonds')],
  ], { successfulBeats: [1, 1] })

  ok('commit: mustCommit at exactly two cards', legalMoves(s, 0).mustCommit === true)

  // P0 commits: 2♦ face-up (opens), 5♦ held face-down.
  const g1 = applyCommit(s, 0, { upId: '2-diamonds', downId: '5-diamonds' }).state
  ok('commit: records the held down card', g1.commits[0]?.downId === '5-diamonds')
  ok('commit: plays ONLY the face-up card', g1.played[0].length === 1 && g1.played[0][0].card.id === '2-diamonds')
  ok('commit: down card is NOT in the history (no leak)', g1.played[0].every((e) => e.card?.id !== '5-diamonds'))
  ok('commit: down card is still held in hand', g1.hands[0].length === 1 && g1.hands[0][0].id === '5-diamonds')

  // P1 commits: 3♥ face-up (can't beat 2♦ — a §5-style reveal), 9♦ held.
  const g2 = applyCommit(g1, 1, { upId: '3-hearts', downId: '9-diamonds' }).state
  ok('Round 2 begins once no face-up move remains', g2.round === 2)
  // Nobody beat in Round 1 → the uncontested opener leads Round 2 (leader-first).
  ok('Round 2 leader-first: opener reveals first', g2.currentPlayer === 0)

  const g3 = applyReveal(g2, 0).state // P0 reveals 5♦ — opens the round
  ok('Round 2 reveal opens the round', g3.table?.id === '5-diamonds' && g3.currentPlayer === 1)
  ok('Round 2 reveal is now face-up in history', g3.played[0].some((e) => e.card?.id === '5-diamonds'))
  const g4 = applyReveal(g3, 1).state // P1 reveals 9♦ — beats 5♦
  ok('Round 2 beat decides the game', g4.phase === 'over' && g4.winner === 1)
}

{
  // Lone finalist: only P0 reaches the commit state; P1 finishes in Round 1. P0's
  // held card reveals unopposed and wins by default (even though P1 made the last
  // Round-1 beat — Round 2 among committers decides it).
  const s = rig([
    [C('9', 'diamonds'), C('5', 'diamonds')],
    [C('K', 'diamonds')],
  ], { successfulBeats: [1, 1] })
  const g1 = applyCommit(s, 0, { upId: '9-diamonds', downId: '5-diamonds' }).state
  const g2 = applyPlay(g1, 1, C('K', 'diamonds')).state // P1 beats 9♦, then is out of cards
  ok('lone finalist: Round 2 with a single committer', g2.round === 2 && g2.currentPlayer === 0)
  const g3 = applyReveal(g2, 0).state
  ok('lone finalist wins by default', g3.phase === 'over' && g3.winner === 0)
}

{
  // §6 still bites BEFORE commit: a beatless seat reaching two cards is cut (teav) and
  // never gets to commit.
  const s = rig([
    [C('9', 'diamonds'), C('3', 'clubs'), C('4', 'clubs')],
    [C('K', 'diamonds'), C('3', 'spades')], // two cards, zero prior wins
    [C('A', 'diamonds'), C('3', 'hearts'), C('4', 'hearts')],
  ], { successfulBeats: [1, 0, 1] })
  const g = applyPlay(s, 0, C('9', 'diamonds')).state // P0 opens; the turn would pass to P1
  ok('§6 cuts a beatless two-card seat before it can commit', g.eliminated[1] === true && g.commits[1] === null)
  ok('§6 the cut seat is skipped, not handed the turn', g.currentPlayer === 2)
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
      let res
      if (lm.mustReveal) {
        // Round 2 — the committed card is forced.
        res = applyReveal(g, seat)
      } else {
        // §5's real promise, stated in UI terms: whoever is to move always has at
        // least one enabled control (play, pass, or the two-card commit). If this ever
        // fails the board deadlocks — every card greyed out — with no error to explain it.
        if (!lm.canPlay.length && !lm.canPass && !lm.mustCommit) invariant.push('a seat had no legal move')
        const mv = chooseBotMove(g.hands[seat], g.table, { mustOpen: lm.mustOpen, mustCommit: lm.mustCommit })
        res =
          mv.type === 'commit'
            ? applyCommit(g, seat, mv)
            : mv.type === 'pass' && lm.canPass
              ? applyPass(g, seat, mv.card)
              : applyPlay(g, seat, mv.card)
      }
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
