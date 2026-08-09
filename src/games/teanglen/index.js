import Board from './Board.jsx'
import { createMatch, applyPlay, applySkip } from './match.js'
import { chooseBotMoveElite } from './ai.js'

// Teang Len (Cambodian/Vietnamese Tiến Lên) — the first game module, and the one
// that shaped the contract in ../contract.js. See that file before adding a second.
//
// This file is the ONLY part of the folder the shell may import. Everything else
// here — the rank order, the combination classifier, canBeat, the tap suggester —
// is Teang Len's own business and stays behind this door, so a second game is free
// to have nothing in common with it.

/** @type {import('../contract.js').GameModule} */
export default {
  meta: {
    code: 'teanglen',
    name: 'Teang Len',
    minPlayers: 2,
    maxPlayers: 4,
    // Mirrored in the backend catalog (backend/src/config/games.ts), which is the
    // authority — the server runs the turn timer that actually evicts a seat. This
    // copy only drives the on-screen ring.
    turnSeconds: 15,
  },

  createMatch,
  Board,

  // AFK autoplay. Runs on a CLIENT, because the server can't read `state` — it takes
  // the seat's own hand and the play on the table and returns the next state, so the
  // caller can relay it exactly like a human move. Null means "nothing to do".
  bot(state, seat) {
    // `omniscient: false` is not optional here. This is AFK cover inside a REAL room,
    // and `state.hands` carries every player's cards (trust model v1, see match.js) —
    // an omniscient bot covering an absent seat would be reading a live opponent's
    // hand to play against them. Solo-vs-bots opts in explicitly (Board.jsx).
    const move = chooseBotMoveElite(state, seat, { omniscient: false })
    const res = move ? applyPlay(state, seat, move) : applySkip(state, seat)
    return res.error ? null : res.state
  },

  // Seat indices in finish order → the seats themselves, so the shared result UI
  // never has to index back into a game-specific state shape.
  summarize(state) {
    return {
      finished: state.phase === 'over',
      ranked: state.ranked.map((seat) => state.seats[seat]),
    }
  },
}
