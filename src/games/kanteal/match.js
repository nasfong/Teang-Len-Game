import { canBeat, deal, FACE_UP_AT } from './engine.js'

// Kanteal turn flow — the PURE, serializable state machine. Every function takes a
// full state and returns the next one, so any client can compute its own move and
// relay the result (the backend never reads this; see ../contract.js).
//
// Everything here is plain JSON — no Map/Set, no class instances — because the
// whole state goes over a socket.
//
// ── The shape of a game ───────────────────────────────────────────────────────
// Play is a sequence of CYCLES (§3). One player opens with any card; every other
// player still in the game then acts exactly once, clockwise. The cycle ends when
// everyone has acted, and the last player who successfully BEAT during it wins the
// cycle and opens the next. The winner of the FINAL cycle wins the game (§4) —
// emptying your hand first wins nothing.
//
// Two rules make this harder than it looks and are the source of most of the code
// below:
//   §5 at ≤2 cards you may no longer pass, and a card that cannot beat is played
//      face-up anyway — it leaves the hand but takes nothing.
//   §6 the SUCCESSFUL-BEAT REQUIREMENT. Reaching ≤2 cards having never WON a trick
//      cuts you from the game — see `successfulBeats` and `failsBeatGate` below.
//
// ── §6 in full — the successful-beat requirement ──────────────────────────────
// Merely PLAYING is not enough: a player must have WON at least one completed cycle
// (a beat that no one beat back, or an uncontested open) before they may finish. A
// beat that is later beaten counts for nothing. When a player is reduced to their
// last two cards (`faceUpAt`) with zero successful beats, they lose immediately —
// they may not play those cards, keep challenging, or open — and take last place.
// This early loss is called "TEAV" (ធាវ): the player must DROP their remaining cards
// FACE-DOWN in front of them, so the table can see they are out (see cutSeat). This
// stops a player coasting on stronger players' beats without ever taking a trick
// themselves. The credit is banked at CYCLE END (endCycle), never at the moment a
// card is played, because only then is a beat known to have held.

// PLACEHOLDER (§3) — if a whole cycle passes with NO successful beat, the opener is
// treated as the cycle winner. The spec flags this as invented to fill a gap, and it
// can decide the game, since the game's winner is a cycle winner. Kept as a named
// flag so it is easy to find and re-check against real play. It ALSO decides whether
// an uncontested open banks a successful beat (winning that cycle is what does).
export const DEFAULT_RULES = {
  openerWinsUncontestedCycle: true,
  // The hand size at which hidden passing stops and the successful-beat cut is
  // measured. Settable rather than hard-coded because the spec's balance note calls
  // it out as the first dial to turn if the cut proves too harsh. See ./analyse.mjs.
  faceUpAt: FACE_UP_AT,

  // §4 has TWO readings of who wins, and they disagree on roughly a quarter of
  // 4-player games (measured — see ./analyse.mjs):
  //   false — the winner of the FINAL CYCLE, i.e. its opener when nobody beat in it.
  //           §4A's literal wording. This is the default, and what shipped.
  //   true  — the last player to beat ANYWHERE in the game. §4's headline wording:
  //           "the player who makes the latest successful beat is the winner."
  // They differ when the final cycle is uncontested AND its opener isn't the last
  // player to have actually beaten — e.g. the cycle winner ran out of cards, so the
  // next seat opened, and then nobody could answer.
  winnerIsLastBeatOverall: false,
}

// Rules travel INSIDE the state (it's relayed to every client), so a match always
// resolves against the variation it was dealt with — a client can't drift by having
// been built with a different default.
const faceUpAt = (state) => state.rules?.faceUpAt ?? FACE_UP_AT

// A seat that can still take a turn. Note the two ways to be out are DIFFERENT:
// eliminated (§6) is out for good and can never win, whereas simply running out of
// cards is neutral — that player still wins if their beat was the last one standing.
const canAct = (state, seat) => !state.eliminated[seat] && state.hands[seat].length > 0
const alive = (state) => state.seats.map((_, i) => i).filter((i) => !state.eliminated[i])
const holdingCards = (state) => state.seats.map((_, i) => i).filter((i) => canAct(state, i))

// Final challenge. A committed seat has already made its Round-1 move (its face-up
// card) and now holds only its reserved face-down card, so it takes NO further part
// in Round 1 — the turn skips past it until the Round-2 reveal.
const isCommitted = (state, seat) => state.commits?.[seat] != null
const canActR1 = (state, seat) => canAct(state, seat) && !isCommitted(state, seat)
const committers = (state) =>
  state.seats.map((_, i) => i).filter((i) => isCommitted(state, i) && !state.eliminated[i])

// Next seat clockwise from `from` satisfying `ok`, or null. Walks the ring by seat
// index, which IS clockwise order (seats are stored in table order).
function nextWhere(state, from, ok) {
  for (let s = 1; s <= state.seats.length; s++) {
    const q = (from + s) % state.seats.length
    if (ok(q)) return q
  }
  return null
}

// End the game with a winner.
const finish = (state, winner) => ({ ...state, phase: 'over', winner, turnKey: state.turnKey + 1 })

// Cut a seat from the game — "TEAV" (ធាវ), the early loss (§6). Having failed the
// successful-beat requirement, the player is out — and MUST drop the cards still in
// their hand FACE-DOWN in front of them, so the whole table can see at a glance that
// they have already lost. The cards leave the hand as {hidden:true} history entries,
// the exact shape a §3 pass uses: the identity is never stored, so it is never
// relayed (opponents can't read a loser's hand), and PlayArea draws them as backs.
const cutSeat = (state, seat) => ({
  ...state,
  eliminated: state.eliminated.map((e, i) => (i === seat ? true : e)),
  hands: state.hands.map((h, i) => (i === seat ? [] : h)),
  played: state.played.map((p, i) => (i === seat ? [...p, ...state.hands[seat].map(() => ({ hidden: true }))] : p)),
})

// §6 — the successful-beat gate. TRUE when `seat` has reached the ≤2-card endgame
// having never WON a trick, so it must be cut rather than allowed to play on.
//
//   holds cards         a seat that already emptied its hand isn't "reaching" the
//                       endgame; it's done, and may still win on a beat that stood.
//   successfulBeats 0   never won a completed cycle — the whole point of the rule.
//   seat !== holder     the seat that currently HOLDS THE TABLE (the beat leader,
//                       or the opener while a cycle is uncontested) is mid-trick;
//                       its beat/open isn't decided yet, so it can't be cut for it.
//                       Pass `holder = null` where nobody yet holds the table (the
//                       moment a NEW opener is being chosen — opening is not a right
//                       a beatless endgame seat has earned).
const failsBeatGate = (state, seat, holder) =>
  !state.eliminated[seat] &&
  state.hands[seat].length > 0 &&
  state.hands[seat].length <= faceUpAt(state) &&
  (state.successfulBeats[seat] ?? 0) === 0 &&
  seat !== holder

/**
 * Deal a fresh game. `seats` = [{ playerId, name }] in seat order.
 * `startingPlayerId` opens the first cycle (the room's winnerStartsNextGame rule);
 * omit it and seat 0 opens.
 */
export function createMatch(seats, { startingPlayerId = null, rules = DEFAULT_RULES } = {}) {
  const { hands } = deal(seats.length)
  const prev = startingPlayerId ? seats.findIndex((s) => s.playerId === startingPlayerId) : -1
  const opener = prev >= 0 ? prev : 0
  return {
    seats,
    hands, // hands[seat] = card[]
    rules,
    table: null, // the card on the table; null means a cycle is being opened
    opener, // who opened this cycle
    leader: null, // last seat to successfully BEAT this cycle (opening is not a beat)
    lastBeater: null, // last seat to beat in the WHOLE game — survives the cycle reset
    currentPlayer: opener,
    acted: seats.map(() => false), // who has taken their one turn this cycle
    eliminated: seats.map(() => false), // §6 — cut from the game, cards never revealed
    // §6 — successful-beat requirement. Count of completed cycles each seat has WON
    // (banked at cycle end). A seat with 0 of these is cut on reaching ≤2 cards. It
    // starts at 0 for everyone, so a fresh match resets the requirement (§6).
    successfulBeats: seats.map(() => 0),
    discards: seats.map(() => 0), // §3 — face-down passes. A COUNT ONLY, never the cards

    // Every card each seat has played, oldest first, and it is NEVER cleared — not
    // when a card is beaten, not when the cycle turns. This mirrors the real table:
    // you lay your card down in front of you and it stays there, so anyone can read
    // back what everyone has played.
    //
    // Two entry shapes, and the difference is the whole point:
    //   { card }        played face-up — an open, a beat, or a §5 reveal
    //   { hidden: true } passed face-down (§3). Carries NO card, deliberately: the
    //                    rule says a discard is "hidden from everyone and gone for
    //                    good", so storing the identity would leak it into a state
    //                    that is relayed to every client. Order is preserved; the
    //                    card is not.
    played: seats.map(() => []),
    reveals: [], // §5 non-beating cards played face-up this cycle (display)
    challenge: null, // §7 { seat, card } — display only, never affects legality
    // Final challenge (two-card pre-commit). When a seat is at exactly its last two
    // cards on its turn, it COMMITS both at once: one card face-up now (its normal
    // Round-1 move), the other held face-down for the Round-2 reveal. commits[seat]
    // = { downId } records which held card is reserved; that card STAYS in hands[seat]
    // (relayed like any hand, drawn face-down by clients — it must NEVER be written to
    // `played`, which is shown face-up to all, until it is revealed). null = not
    // committed. `round` is 1 during normal face-up play and flips to 2 for the
    // terminal reveal, once no seat can make a face-up move anymore.
    commits: seats.map(() => null),
    round: 1,
    cycle: 0,
    phase: 'playing', // 'playing' | 'over'
    winner: null, // seat index once phase is 'over'
    turnKey: 0, // bumps every turn — the seat-ring timer keys on it
  }
}

// ── Cycle resolution ──────────────────────────────────────────────────────────

// End the current cycle and either finish the game or open the next one.
function endCycle(state) {
  // §3.4 — the cycle winner is the last player who beat. With no beats at all, the
  // opener takes it (the PLACEHOLDER above).
  const cycleWinner = state.leader ?? (state.rules.openerWinsUncontestedCycle ? state.opener : null)

  // §6 — bank the successful beat. WINNING a completed cycle (a beat that held, or
  // an uncontested open per the placeholder) is the only thing that proves a player
  // took a trick; a beat that was beaten back is not the cycle winner and earns
  // nothing. This is why the credit lives here and not in applyPlay.
  let s = state
  if (cycleWinner !== null) {
    s = { ...s, successfulBeats: s.successfulBeats.map((n, i) => (i === cycleWinner ? n + 1 : n)) }
  }

  // Who takes the GAME if this turns out to be the last cycle. The game-wide reading
  // falls back to the cycle winner if the last beater was since cut (§6).
  const lastBeat = s.rules?.winnerIsLastBeatOverall ? s.lastBeater : null
  const gameWinner = lastBeat != null && !s.eliminated[lastBeat] ? lastBeat : cycleWinner

  // §4A — no cards left anywhere, so no further cycle can begin. The winner of this
  // last cycle wins the game: "the player who makes the latest successful beat".
  if (holdingCards(s).length === 0) return finish(s, gameWinner)

  // The cycle winner opens next (§3.4) — unless they have no cards left to open
  // with, in which case the next seat clockwise who does opens instead. Then §6:
  // a beatless seat at the ≤2-card endgame may not open (opening is playing a card,
  // and it never won a trick) — cut it and pass the open on, exactly as the turn
  // gate does mid-cycle. `holder = null`: nobody holds the new table yet.
  const base = cycleWinner ?? state.opener
  let opener = canActR1(s, base) ? base : nextWhere(s, base, (q) => canActR1(s, q))
  for (;;) {
    if (opener === null) {
      // No seat can make a face-up move — Round 1 is exhausted. If any seat is holding
      // a committed face-down card, resolve those now (Round 2); otherwise the game is
      // simply over on the latest successful beat.
      return committers(s).length > 0 ? enterRound2(s) : finish(s, gameWinner)
    }
    if (!failsBeatGate(s, opener, null)) break
    s = cutSeat(s, opener)
    const survivors = alive(s)
    if (survivors.length === 1) return finish(s, survivors[0])
    opener = nextWhere(s, opener, (q) => canActR1(s, q))
  }

  return {
    ...s,
    table: null,
    opener,
    leader: null,
    currentPlayer: opener,
    acted: s.seats.map(() => false),
    reveals: [], // §7 — the challenge display resets with the cycle
    challenge: null,
    cycle: s.cycle + 1,
    turnKey: s.turnKey + 1,
  }
}

// Everything after an action: apply the §6 endgame cut, check for a lone survivor,
// then either pass the turn on or close the cycle. One place, so the flow can't
// diverge — pass, a beaten-back beat, and a stalled open all funnel through here.
function settle(state, actor) {
  let next = { ...state, acted: state.acted.map((a, i) => (i === actor ? true : a)) }

  // §6 — cut the ACTOR if this move dropped it into the ≤2-card endgame with no win
  // to its name (a pass, or a §5 reveal). A beat is protected: it just set `leader`
  // to the actor, so `holder` is the actor and the gate spares it until the cycle
  // resolves. This is the "immediately lose" of the rule.
  const holder = next.leader ?? next.opener
  if (failsBeatGate(next, actor, holder)) next = cutSeat(next, actor)

  // §4B — elimination has left one player standing; they win immediately, cards or
  // not. Checked before handing the turn on, since it ends the game outright.
  let survivors = alive(next)
  if (survivors.length === 1) return finish(next, survivors[0])

  // §3.2 — everyone still in the game acts exactly once. This asks who has NOT acted
  // rather than counting turns, because elimination can shrink the field midcycle.
  // Any beatless ≤2-card seat we'd hand control to is cut first (§6): it may not
  // play its last cards, so control skips past it to the next eligible seat.
  let from = actor
  for (;;) {
    // canActR1, not canAct: a committed seat holds only its face-down card and is done
    // with Round 1, so control skips it until the Round-2 reveal.
    const up = nextWhere(next, from, (q) => canActR1(next, q) && !next.acted[q])
    if (up === null) return endCycle(next)
    if (!failsBeatGate(next, up, next.leader ?? next.opener)) {
      return { ...next, currentPlayer: up, turnKey: next.turnKey + 1 }
    }
    next = cutSeat(next, up)
    survivors = alive(next)
    if (survivors.length === 1) return finish(next, survivors[0])
    from = up
  }
}

// ── Round 2 — the final reveal ─────────────────────────────────────────────────

// Round 1 is over and one or more seats hold a committed face-down card. Switch to
// the terminal reveal: the Round-1 leader (the latest successful beater still holding
// a card, else a fallback) reveals first — their card opens the round — then every
// other committer reveals in turn order and tries to beat it.
function enterRound2(state) {
  const parts = committers(state)
  // Leader-first. Prefer the game-wide last beater (the "latest successful beat"),
  // then this cycle's leader, then the lowest-seat committer — whichever is actually a
  // committer still holding its down card (the last beater may have been a non-
  // committer who has since run out).
  const ready = (seat) => seat != null && isCommitted(state, seat) && !state.eliminated[seat]
  const first = ready(state.lastBeater) ? state.lastBeater : ready(state.leader) ? state.leader : parts[0]
  return {
    ...state,
    round: 2,
    table: null, // the first reveal opens the round
    leader: null,
    opener: first, // uncontested → the first revealer wins, mirroring a cycle
    currentPlayer: first,
    acted: state.seats.map(() => false),
    reveals: [],
    challenge: null,
    turnKey: state.turnKey + 1,
  }
}

// After a Round-2 reveal: hand the turn to the next committer who hasn't revealed, or
// end the game once everyone has. Winner = the last successful beat, else the seat
// that opened the round (its card went unbeaten) — the same rule as a normal cycle.
function settleRound2(state, actor) {
  const next = { ...state, acted: state.acted.map((a, i) => (i === actor ? true : a)) }
  const up = nextWhere(next, actor, (q) => isCommitted(next, q) && !next.eliminated[q] && !next.acted[q])
  if (up === null) return finish(next, next.leader ?? next.opener)
  return { ...next, currentPlayer: up, turnKey: next.turnKey + 1 }
}

// ── Actions ───────────────────────────────────────────────────────────────────

const turnError = (state, seat) => {
  if (state.phase !== 'playing') return 'Game is not in progress'
  if (state.currentPlayer !== seat) return 'Not your turn'
  if (state.eliminated[seat]) return "You've been cut from this game"
  return null
}

// Place one card face-up in front of `seat` and update the table — the shared core
// of a normal play and a commit's face-up card. Returns the PRE-settle next state (or
// an error); the caller settles, so a commit can record its held card first.
function placeUp(state, seat, held) {
  const hand = state.hands[seat]
  const isOpening = state.table === null
  const beats = !isOpening && canBeat(held, state.table)

  // A non-beating card is only playable once hidden passing has stopped (§5). Above
  // that, the play is simply illegal — pass instead.
  if (!isOpening && !beats && hand.length > faceUpAt(state)) {
    return { error: `That doesn't beat the ${state.table.rank}${SUIT_MARK[state.table.suit]} — pass instead.` }
  }

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== held.id) : h))
  // Laid face-up in front of this seat, permanently — an open, a beat, and a §5
  // reveal are all cards the table has seen.
  const played = state.played.map((p, i) => (i === seat ? [...p, { card: held }] : p))
  const next = { ...state, hands, played }

  if (isOpening) {
    // §3 — opening beats nothing, so it does NOT set `leader`; an uncontested cycle
    // falls back to the opener at endCycle. §6: opening is NOT proof of life on its
    // own — only WINNING the cycle it starts banks a successful beat (see endCycle).
    next.table = held
  } else if (beats) {
    next.table = held
    next.leader = seat
    next.lastBeater = seat // game-wide, unlike `leader` which endCycle clears
    // §7 — display only. The challenge STARTS when someone holding exactly the
    // face-up threshold lands a beat, and once started, every later beat in the
    // cycle takes it over regardless of hand size.
    if (state.challenge || hand.length === faceUpAt(state)) next.challenge = { seat, card: held }
  } else {
    // §5 — revealed to everyone, gone from the hand, and it wins nothing: the table
    // card and the beat leader are both unchanged.
    next.reveals = [...state.reveals, { seat, card: held }]
  }
  return { next }
}

/**
 * Play one card face-up. Covers all three cases the rules allow:
 *   opening a cycle (§3) — any card is legal, and it counts as a beat for §6
 *   beating (§2)         — same suit, strictly higher rank
 *   revealing (§5)       — at ≤2 cards a card that CANNOT beat is played anyway:
 *                          it leaves the hand, but takes neither the table nor the lead
 */
export function applyPlay(state, seat, card) {
  const err = turnError(state, seat)
  if (err) return { error: err }
  const held = state.hands[seat].find((c) => c.id === card.id)
  if (!held) return { error: 'That card is not in your hand' }
  const r = placeUp(state, seat, held)
  if (r.error) return { error: r.error }
  return { state: settle(r.next, seat) }
}

/**
 * Final challenge — commit both of your last two cards in one locked action. `up` is
 * played face-up now (its normal open/beat/§5 handling); `down` is reserved face-down
 * (commits[seat]) and stays in the hand, hidden, until the Round-2 reveal. There is no
 * move to change which is which afterwards.
 */
export function applyCommit(state, seat, { upId, downId }) {
  const err = turnError(state, seat)
  if (err) return { error: err }
  if (state.round === 2) return { error: 'Round 2 — reveal only' }
  const hand = state.hands[seat]
  if (hand.length !== faceUpAt(state)) return { error: 'Commit is only for your last two cards' }
  if (upId === downId) return { error: 'Pick two different cards' }
  const up = hand.find((c) => c.id === upId)
  const down = hand.find((c) => c.id === downId)
  if (!up || !down) return { error: 'Those cards are not in your hand' }

  const r = placeUp(state, seat, up)
  if (r.error) return { error: r.error }
  // Record the held card BEFORE settling, so the turn-advance skips this seat for the
  // rest of Round 1 and the down card is treated as committed everywhere downstream.
  const committed = { ...r.next, commits: r.next.commits.map((c, i) => (i === seat ? { downId } : c)) }
  return { state: settle(committed, seat) }
}

/**
 * Pass by discarding one card FACE-DOWN (§3). The card is hidden from everyone and
 * gone for good — only `discards[seat]`, a count, is ever public. Callers must not
 * put the card anywhere the state can carry it.
 */
export function applyPass(state, seat, card) {
  const err = turnError(state, seat)
  if (err) return { error: err }
  // §3 — the opener must play a real card; opening by passing is not allowed.
  if (state.table === null) return { error: "You're opening the cycle — you must play a card." }
  const hand = state.hands[seat]
  if (hand.length <= faceUpAt(state)) return { error: 'Down to your last cards — they must be played face-up.' }
  const held = hand.find((c) => c.id === card.id)
  if (!held) return { error: 'That card is not in your hand' }

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== held.id) : h))
  const next = {
    ...state,
    hands,
    discards: state.discards.map((d, i) => (i === seat ? d + 1 : d)),
    // Face-down in front of this seat: the table sees THAT you discarded and in
    // what order, never what. No card object is stored (see `played` above).
    played: state.played.map((p, i) => (i === seat ? [...p, { hidden: true }] : p)),
  }

  // §6 — the endgame cut is applied in settle, uniformly for every kind of move, so
  // a seat that reaches ≤2 cards is cut the same whether it got there by passing or
  // by a beat that was later beaten. Their dropped cards are never revealed.
  return { state: settle(next, seat) }
}

/**
 * Round 2 — reveal your held face-down card. Forced (the up/down assignment was locked
 * at commit), so it takes no card argument. The card is laid face-up in front of you
 * and tries to beat the table: the first reveal of the round opens it, a beat takes
 * the lead, a non-beating reveal simply lands and wins nothing. Then the turn passes
 * to the next committer, or the game ends on the latest successful beat.
 */
export function applyReveal(state, seat) {
  if (state.phase !== 'playing') return { error: 'Game is not in progress' }
  if (state.round !== 2) return { error: 'Not the reveal round' }
  if (state.currentPlayer !== seat) return { error: 'Not your turn' }
  const commit = state.commits[seat]
  if (!commit) return { error: 'Nothing to reveal' }
  const held = state.hands[seat].find((c) => c.id === commit.downId)
  if (!held) return { error: 'Held card is missing' }

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== held.id) : h))
  const played = state.played.map((p, i) => (i === seat ? [...p, { card: held }] : p))
  const commits = state.commits.map((c, i) => (i === seat ? null : c))
  const next = { ...state, hands, played, commits }

  if (next.table === null) {
    next.table = held // leader-first reveal opens the round
  } else if (canBeat(held, next.table)) {
    next.table = held
    next.leader = seat
    next.lastBeater = seat
  }
  // else: revealed but can't beat — wins nothing, table + leader unchanged.

  return { state: settleRound2(next, seat) }
}

// ── Views ─────────────────────────────────────────────────────────────────────

const SUIT_MARK = { spades: '♠', clubs: '♣', diamonds: '♦', hearts: '♥' }

/** What the seat may do right now — drives which buttons the board enables. */
export function legalMoves(state, seat) {
  if (state.phase !== 'playing' || state.currentPlayer !== seat || state.eliminated[seat]) {
    return { canPlay: [], canPass: false, mustOpen: false, mustCommit: false, mustReveal: false }
  }
  // Round 2: the only move is to reveal the committed face-down card (forced).
  if (state.round === 2) {
    return { canPlay: [], canPass: false, mustOpen: false, mustCommit: false, mustReveal: isCommitted(state, seat) }
  }
  const hand = state.hands[seat]
  const mustOpen = state.table === null
  // Final challenge: at exactly the last two cards, the turn is a two-card COMMIT (one
  // face-up now, one held face-down), not a single play.
  const mustCommit = hand.length === faceUpAt(state)
  // At ≤2 cards every card is playable, beating or not (§5).
  const canPlay = mustOpen || hand.length <= faceUpAt(state) ? hand : hand.filter((c) => canBeat(c, state.table))
  return { canPlay, canPass: !mustOpen && hand.length > faceUpAt(state), mustOpen, mustCommit, mustReveal: false }
}

/**
 * The flags a game:play emit carries so the server can settle the pot. Kanteal has
 * ONE winner and no ranking beyond first place (§4) — but the server's winner-take-
 * all settlement needs to know EVERY participant, since each non-winner pays a bet.
 * So `rankings` lists all seats: the winner at rank 1, everyone else tied at rank 2
 * (there is no 2nd/3rd in Kanteal). The server reads only "rank 1 vs not" for the
 * pot; the exact loser rank is immaterial.
 */
export function deriveFlags(state) {
  if (state.phase !== 'over' || state.winner === null) return {}
  return {
    gameOver: true,
    rankings: state.seats.map((s, i) => ({ playerId: s.playerId, rank: i === state.winner ? 1 : 2 })),
  }
}

export const mySeatIndex = (state, playerId) => state.seats.findIndex((s) => s.playerId === playerId)
export { SUIT_MARK }
