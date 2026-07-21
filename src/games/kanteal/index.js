import Board from './Board.jsx'
import { createMatch, applyPass, applyPlay, legalMoves } from './match.js'
import { chooseBotMove, MAX_PLAYERS, MIN_PLAYERS } from './engine.js'

// Kanteal (កន្ទេល) — the second game module, and the one that proved the contract in
// ../contract.js holds without widening. Nothing from Teang Len is reused: different
// rank order, no suit ranking, one card per turn, cycles instead of tricks, and
// elimination. The only shared code is the component library (Table, Hand,
// PlayingCard), which is exactly the seam the split was designed around.
//
// Rules live behind this door. See ./verify.mjs for the §-by-§ checks
// (`node src/games/kanteal/verify.mjs`).

/** @type {import('../contract.js').GameModule} */
export default {
  meta: {
    id: 'kanteal',
    name: 'Kanteal',
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    turnSeconds: 20,
  },

  createMatch,
  Board,

  // AFK autoplay — beat if you can, else discard your weakest card, else (at ≤2
  // cards, where passing is illegal) reveal it face-up. §5 guarantees a legal move
  // always exists, so this never returns null for a seat that can act.
  bot(state, seat) {
    const lm = legalMoves(state, seat)
    const mv = chooseBotMove(state.hands[seat], state.table, { mustOpen: lm.mustOpen, faceUpAt: state.rules?.faceUpAt })
    if (!mv) return null
    const res = mv.type === 'pass' && lm.canPass ? applyPass(state, seat, mv.card) : applyPlay(state, seat, mv.card)
    return res.error ? null : res.state
  },

  // §4 — one winner, and no ranking beyond first place. Nothing is scored, and
  // emptying your hand first wins nothing, so there is no order to report.
  summarize(state) {
    return {
      finished: state.phase === 'over',
      ranked: state.winner == null ? [] : [state.seats[state.winner]],
    }
  },
}
