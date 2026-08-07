// Teang Len bot simulation — pits chooseBotMovePro (pro) against chooseBotMove (greedy)
// over many full 4-seat games and prints win rates, so the pro bot's edge is measurable
// rather than assumed. Pure Node, no browser APIs.
//
//   node src/games/teanglen/simulate.js [gamesPerConfig]
//
// A "win" is finishing first (emptying your hand first). With 4 equal seats the fair
// share is 25%; a stronger strategy should beat its fair share.

import { deal, classify, sortCards, chooseBotMove, chooseBotMovePro } from './engine.js'

// Strategy adapters share one shape: (hand, current, context) => cards | null.
const greedy = (hand, current) => chooseBotMove(hand, current)
const pro = (hand, current, context) => chooseBotMovePro(hand, current, context)

const nextIdx = (i, active) => {
  let x = (i + 1) % 4
  while (!active[x]) x = (x + 1) % 4
  return x
}

// Play ONE full game. `strategies[seat]` decides that seat's moves. Returns the finish
// order (an array of seat indices, first-out first).
function playGame(strategies) {
  const { hands, starter } = deal(4)
  const H = hands.map((h) => h.map((c) => ({ ...c })))
  const active = [true, true, true, true]
  const finish = []

  let current = null // the play on the table (null = a fresh trick, this seat leads)
  let leader = starter // who owns the table; the trick resets to them
  let turn = starter
  let passes = 0
  let guard = 0

  const activeCount = () => active.reduce((n, a) => n + (a ? 1 : 0), 0)

  while (finish.length < 3 && guard++ < 100000) {
    if (!active[turn]) {
      turn = nextIdx(turn, active)
      continue
    }
    const hand = H[turn]
    const context = {
      opponentCounts: [0, 1, 2, 3].filter((s) => s !== turn && active[s]).map((s) => H[s].length),
    }

    let move = strategies[turn](hand, current, context)
    // A leader must play something; fall back to the lowest single if a strategy
    // returned nothing while opening.
    if (current === null && (!move || !move.length)) move = [sortCards(hand)[0]]

    if (current !== null && (!move || !move.length)) {
      // Pass. When everyone who could still answer the leader has passed, the trick is
      // over and control returns to the leader (or the next live seat if they went out).
      passes++
      const responders = activeCount() - (active[leader] ? 1 : 0)
      if (passes >= responders) {
        current = null
        passes = 0
        turn = active[leader] ? leader : nextIdx(leader, active)
      } else {
        turn = nextIdx(turn, active)
      }
      continue
    }

    // Play the move. Bots are trusted to return a legal beat (the engine is the same one
    // that produced it); classify drives the table state.
    const play = classify(move)
    const ids = new Set(move.map((c) => c.id))
    H[turn] = hand.filter((c) => !ids.has(c.id))
    current = play
    leader = turn
    passes = 0

    if (H[turn].length === 0) {
      active[turn] = false
      finish.push(turn)
    }
    turn = nextIdx(turn, active)
  }

  // The last seat still holding cards finishes last.
  const last = active.indexOf(true)
  if (last >= 0 && !finish.includes(last)) finish.push(last)
  return finish
}

// Run `games` games with the given per-seat strategy LABELS, rotating the seat mapping
// each game so seat bias (the 3♠ opener, position) can't favour one label. Returns wins
// keyed by label.
function runConfig(labels, strategyByLabel, games) {
  const wins = {}
  for (const l of labels) wins[l] = (wins[l] ?? 0)
  let plays = 0
  for (let g = 0; g < games; g++) {
    // Rotate which physical seat each label sits in.
    const rot = g % 4
    const seatLabels = [0, 1, 2, 3].map((s) => labels[(s + rot) % 4])
    const strategies = seatLabels.map((l) => strategyByLabel[l])
    const finish = playGame(strategies)
    const winnerSeat = finish[0]
    wins[seatLabels[winnerSeat]] = (wins[seatLabels[winnerSeat]] ?? 0) + 1
    plays++
  }
  return { wins, plays }
}

function pct(n, d) {
  return `${((100 * n) / d).toFixed(1)}%`
}

function report(title, labels, result) {
  console.log(`\n${title}  (${result.plays} games)`)
  // Aggregate by strategy name, and by how many seats that strategy occupied.
  const counts = {}
  for (const l of labels) counts[l] = (counts[l] ?? 0) + 1
  const seen = new Set()
  for (const l of labels) {
    if (seen.has(l)) continue
    seen.add(l)
    const seats = counts[l]
    const fair = pct(seats, 4) // fair share for that many of four seats
    console.log(`  ${l.padEnd(8)} won ${pct(result.wins[l], result.plays).padStart(6)}   (${seats}/4 seats, fair share ${fair})`)
  }
}

const GAMES = Number(process.argv[2]) || 3000
// Distinct labels g0..g3 / p0..p3 all map to one strategy — used by the baselines to
// read a PER-SEAT-role win rate (should be ~25% each if the harness has no bias).
const strategyByLabel = { pro, greedy, g0: greedy, g1: greedy, g2: greedy, g3: greedy, p0: pro, p1: pro, p2: pro, p3: pro }

console.log(`Teang Len bot simulation — ${GAMES} games per config`)
console.log('A win = finishing first. Seat mapping rotates each game to cancel seat bias.')

// 1 pro vs 3 greedy — the cleanest read on the strategy edge (fair share 25%).
report('① 1 pro vs 3 greedy', ['pro', 'greedy', 'greedy', 'greedy'], runConfig(['pro', 'greedy', 'greedy', 'greedy'], strategyByLabel, GAMES))

// 2 pro vs 2 greedy — pro should take well over half (fair share 50% for two seats).
report('② 2 pro vs 2 greedy', ['pro', 'pro', 'greedy', 'greedy'], runConfig(['pro', 'pro', 'greedy', 'greedy'], strategyByLabel, GAMES))

// Baselines — four of the SAME strategy, distinct labels, so each should land near 25%.
// A clean sanity check that the harness itself doesn't favour a seat/rotation slot.
report('③ all greedy (harness sanity)', ['g0', 'g1', 'g2', 'g3'], runConfig(['g0', 'g1', 'g2', 'g3'], strategyByLabel, GAMES))
report('④ all pro (harness sanity)', ['p0', 'p1', 'p2', 'p3'], runConfig(['p0', 'p1', 'p2', 'p3'], strategyByLabel, GAMES))
