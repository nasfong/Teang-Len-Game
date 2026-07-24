import { useEffect, useReducer, useState } from 'react'
import Table from '../Table/Table.jsx'
import Hand from '../Hand/Hand.jsx'
import TrickPile from '../TrickPile/TrickPile.jsx'
import TurnTimer from '../TurnTimer/TurnTimer.jsx'
import Button from '../Button/Button.jsx'
import { deal, classify, canBeat, validatePlay, chooseBotMove, sortCards, label, DEFAULT_FEATURES } from '../../games/teanglen/engine.js'

// GameTable — a playable Teang Len demo. Deals four seats, runs the turn/skip/
// trick/rank flow from GAME_RULES.md, and drives the three other seats as simple
// opponents so one person can play the whole table in the workbench. Composes
// Table (seats + felt + hand slot), Hand (your fan), TrickPile (the centre),
// TurnTimer (the seat ring via Table, and a centre countdown that auto-deals the
// next game) and Button (Play / Pass) — so this one screen exercises most of the
// game components at once.
//
// TOP-LEVEL SCENE, not a leaf: it imports five siblings plus the engine. The real
// game is peer-authoritative multiplayer with no bots; the opponents here stand
// in for the other humans so the demo is single-player. All rule logic lives in
// engine.js (pure, tested) — this file is only wiring + presentation.
//
// State is a reducer because a turn touches several fields at once (hands,
// current hand, skip/finish flags, whose turn) and they must move together; a
// pile of useStates would tear. Every mutation ends in settle(), the single place
// that resolves a trick, ranks a finisher and hands the turn on — the same logic
// the engine's 300-game simulation was checked against.

const FEATURES = DEFAULT_FEATURES
const TURN_SECONDS = 15
// How long an opponent "thinks" before playing. Well under TURN_SECONDS, so the
// turn ring never runs out on a bot — its own move lands first and re-arms it.
const BOT_DELAY_MS = 1100

const SEATS = [
  { name: 'You', coin: 12450, isHuman: true },
  { name: 'Sophea', coin: 9800 },
  { name: 'Dara', coin: 3400 },
  { name: 'Rith', coin: 21050 },
]
const HUMAN = 0
// Seat index → screen edge, matching Table's SEAT_ORDER. Ordered AROUND the table
// (bottom → right → top → left) so the plain 0→1→2→3 turn advance walks the ring
// in visual order. Also drives which edge a played combo flies in from.
const SEAT_DIR = ['bottom', 'right', 'top', 'left']

const nextWhere = (state, from, ok) => {
  for (let s = 1; s <= state.seats.length; s++) {
    const q = (from + s) % state.seats.length
    if (ok(q)) return q
  }
  return from
}
const nextActive = (state, from) => nextWhere(state, from, (q) => !state.finished[q])
const nextToAct = (state, from) => nextWhere(state, from, (q) => !state.finished[q] && !state.skipped[q])

function init(gameId = 0) {
  const { hands, dealt, starter } = deal(SEATS.length)
  return {
    gameId, // bumped each deal — the hand's face-down→face-up reveal keys on it
    dealtHand: dealt[HUMAN], // your cards in the order they fell — shown before the sort flip
    seats: SEATS,
    hands,
    current: null, // the play on the table, or null when a lead is owed
    lastPlayer: starter, // owner of the current hand → wins the trick if all pass
    currentPlayer: starter,
    skipped: SEATS.map(() => false),
    finished: SEATS.map(() => false),
    ranked: [], // seat order as hands empty
    beaten: [], // the play the current hand beat — TrickPile draws it peeking behind
    phase: 'playing',
    selected: [],
    message: '', // let the derived hint speak; the opener may be a bot (3♠ holder)
    turnKey: 0,
  }
}

// Everything after a play or a skip: rank a finisher, end the game, resolve the
// trick, or just pass the turn on. One place, so the flow can't diverge.
function settle(state, actor) {
  const unranked = state.seats.map((_, i) => i).filter((i) => !state.finished[i])

  // Only one player still holds cards → they're auto-ranked last; game over.
  if (unranked.length <= 1) {
    const ranked = [...state.ranked]
    if (unranked.length === 1 && !ranked.includes(unranked[0])) ranked.push(unranked[0])
    // ranked[0] is the first to empty their hand — the winner.
    return { ...state, ranked, phase: 'over', message: `🏆 ${state.seats[ranked[0]].name} wins!`, turnKey: state.turnKey + 1 }
  }

  // Trick resolves when nobody but the hand's owner is left to answer (everyone
  // else has skipped or finished). The owner wins it and leads next; if the owner
  // finished on that play, the lead passes to the next active seat.
  if (state.current) {
    const contenders = state.seats
      .map((_, i) => i)
      .filter((i) => !state.finished[i] && !state.skipped[i] && i !== state.lastPlayer)
    if (contenders.length === 0) {
      const leader = state.finished[state.lastPlayer] ? nextActive(state, state.lastPlayer) : state.lastPlayer
      const winnerName = state.seats[state.lastPlayer].name
      return {
        ...state,
        current: null,
        skipped: state.seats.map(() => false),
        currentPlayer: leader,
        message: leader === HUMAN ? `You won the trick — lead again.` : `${winnerName} won the trick.`,
        turnKey: state.turnKey + 1,
      }
    }
  }

  return { ...state, currentPlayer: nextToAct(state, actor), turnKey: state.turnKey + 1 }
}

function play(state, seat, cards) {
  const res = validatePlay(cards, state.current, FEATURES)
  // A bad play only reaches here from the human; report why and keep their turn.
  if (!res.ok) return { ...state, message: res.reason }

  const ids = new Set(cards.map((c) => c.id))
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => !ids.has(c.id)) : h))
  const finished = [...state.finished]
  const ranked = [...state.ranked]
  if (hands[seat].length === 0 && !finished[seat]) {
    finished[seat] = true
    ranked.push(seat)
  }

  const next = {
    ...state,
    hands,
    // The play now being covered slides to the "beaten" slot behind the new one.
    beaten: state.current ? state.current.cards : [],
    current: res.play,
    lastPlayer: seat,
    finished,
    ranked,
    // Only clear the selection when YOU played it — a bot's play must leave your
    // pre-picked cards lifted so they're still queued when your turn arrives.
    selected: seat === HUMAN ? [] : state.selected,
    message: '',
  }
  return settle(next, seat)
}

function reducer(state, action) {
  switch (action.type) {
    case 'select': {
      // Allowed on ANY turn, not just yours — you can pre-pick your cards while
      // waiting so Play is one tap away when the turn reaches you. Only your hand
      // wires onSelect, so this only ever touches your own selection.
      if (state.phase !== 'playing') return state
      const hand = state.hands[HUMAN]
      const card = hand.find((c) => c.id === action.id)
      if (!card) return state

      // Smart combo pick: when there's a same-rank hand to beat (pair/triple/quad),
      // one click grabs a whole set of that rank — click a 5 to answer a pair and
      // both your 5s lift together. Clicking that same set again clears it. If you
      // hold fewer than the set needs, or it's a type we don't assist yet
      // (straights, leads), fall back to toggling the single card so you can still
      // build by hand. Which cards: the lowest suits of the rank, keeping your
      // stronger ones in reserve; the Play button still validates that it beats.
      const SAME_RANK = { pair: 2, triple: 3, quad: 4 }
      const need = state.current ? SAME_RANK[state.current.type] : undefined
      if (need) {
        const ofRank = hand.filter((c) => c.rank === card.rank).map((c) => c.id)
        if (ofRank.length >= need) {
          const set = ofRank.slice(0, need)
          const alreadyPicked = state.selected.length === set.length && set.every((id) => state.selected.includes(id))
          return { ...state, selected: alreadyPicked ? [] : set, message: '' }
        }
      }

      const has = state.selected.includes(action.id)
      return {
        ...state,
        selected: has ? state.selected.filter((x) => x !== action.id) : [...state.selected, action.id],
        message: '',
      }
    }
    case 'play':
      return play(state, action.seat, action.cards)
    case 'skip': {
      if (!state.current) return { ...state, message: "You're leading — you can't pass." }
      const skipped = [...state.skipped]
      skipped[action.seat] = true
      const next = { ...state, skipped, selected: action.seat === HUMAN ? [] : state.selected, message: '' }
      return settle(next, action.seat)
    }
    case 'timeout': {
      // The active seat ran out of time: auto-play the lowest card when opening,
      // otherwise auto-pass. Same policy the spec's turn timer uses.
      const seat = state.currentPlayer
      if (!state.current) return play(state, seat, [sortCards(state.hands[seat])[0]])
      if (seat === HUMAN) return reducer({ ...state }, { type: 'skip', seat })
      return settle({ ...state, skipped: state.skipped.map((v, i) => (i === seat ? true : v)) }, seat)
    }
    case 'finish': {
      // Test hook: end the match right now. Rank whoever already finished, then
      // the rest in seat order, so the end-game flow (centre countdown → auto
      // re-deal) can be seen without playing a hand out.
      const ranked = [...state.ranked]
      state.seats.forEach((_, i) => !ranked.includes(i) && ranked.push(i))
      return { ...state, ranked, phase: 'over', message: `🏆 ${state.seats[ranked[0]].name} wins!`, turnKey: state.turnKey + 1 }
    }
    case 'reset':
      return init(state.gameId + 1)
    default:
      return state
  }
}

// `bare` strips the workbench chrome — the status line and the "Finish game" test
// button that sit BELOW the table — and instead floats the hint as a pill inside
// the felt. That's the form TablePage wants: the table IS the screen, nothing
// hanging off it. The standalone preview leaves it off, keeping the debug affordances.
// `fill` makes the whole scene fill its parent (the table stretches edge-to-edge)
// instead of the centred, capped 860px board — for a full-screen page like
// TablePage. Pairs with `bare`, which drops the status chrome.
export default function GameTable({ bare = false, fill = false, className = '' }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const { seats, hands, current, currentPlayer, phase, selected } = state

  // Deal reveal, in five beats keyed on gameId:
  //   'down'    face-down, cards in DEALT order
  //   'up'      flip up — you see the hand exactly as it fell, unsorted
  //   'flipdown' flip back down, still in dealt order
  //   'resort'  fully face-down now — the cards reorder into rank order, hidden
  //   'sorted'  flip up again — now a tidy, sorted hand
  // The reorder is deferred to 'resort', once the flip-down has finished, so the
  // shuffle into place happens entirely behind the card backs — you only ever see
  // two clean flips, never the cards sliding around face-up.
  //
  // The first beat is set by ADJUSTING STATE DURING RENDER (not an effect): a new
  // gameId remounts the cards with fresh ids, and they must paint face-down on
  // that very first frame or they'd flash their faces before the flip.
  const [reveal, setReveal] = useState('down')
  const [dealtGame, setDealtGame] = useState(state.gameId)
  if (dealtGame !== state.gameId) {
    setDealtGame(state.gameId)
    setReveal('down')
  }
  useEffect(() => {
    const timers = [
      setTimeout(() => setReveal('up'), 300), // flip up: unsorted, cascading 0→12
      setTimeout(() => setReveal('flipdown'), 1500), // cascade done (~1290ms) → flip down
      setTimeout(() => setReveal('resort'), 1760), // fast flip-down done → reorder behind backs
      setTimeout(() => setReveal('sorted'), 1860), // flip up: sorted
    ]
    return () => timers.forEach(clearTimeout)
  }, [state.gameId])

  const isHumanTurn = phase === 'playing' && currentPlayer === HUMAN
  const humanHand = hands[HUMAN]
  // Which order + facing your hand shows. Dealt (unsorted) order through the first
  // three beats, sorted from 'resort' on — but only while the hand is still whole:
  // the moment a card is played the dealt snapshot is stale, so fall back to the
  // live sorted hand.
  const preSort =
    (reveal === 'down' || reveal === 'up' || reveal === 'flipdown') &&
    humanHand.length === state.dealtHand.length
  const handCards = preSort ? state.dealtHand : humanHand
  const handFaceDown = reveal === 'down' || reveal === 'flipdown' || reveal === 'resort'
  // The opening reveal cascades slowly, card by card; the sort flip is quick and
  // moves the whole hand at once.
  const firstFlip = reveal === 'down' || reveal === 'up'
  const handFlipMs = firstFlip ? 450 : 220
  const handFlipStagger = firstFlip ? 45 : 0

  // Opponent turns: after a short "think", the active bot plays or passes. Keyed
  // on turnKey so it re-runs for each new turn; the cleanup cancels the pending
  // move if state moves on first (e.g. the human's timeout fires).
  useEffect(() => {
    if (phase !== 'playing') return
    if (seats[currentPlayer].isHuman) return
    const id = setTimeout(() => {
      const move = chooseBotMove(hands[currentPlayer], current, FEATURES)
      if (move) dispatch({ type: 'play', seat: currentPlayer, cards: move })
      else dispatch({ type: 'skip', seat: currentPlayer })
    }, BOT_DELAY_MS)
    return () => clearTimeout(id)
  }, [state.turnKey, currentPlayer, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // What the human currently has selected, and whether it's playable right now —
  // drives the Play button and the hint line.
  const selectedCards = humanHand.filter((c) => selected.includes(c.id))
  const selectedPlay = selectedCards.length ? classify(selectedCards, FEATURES) : null
  const canPlaySelection =
    isHumanTurn && selectedPlay && (!current || canBeat(selectedPlay, current, FEATURES))

  const players = seats.map((s, i) => ({ name: s.name, coin: s.coin, host: i === HUMAN }))

  // Each opponent's hand as ONE face-down card with their remaining count on it —
  // the way the reference client shows it — not a spread of every back. Pass a
  // single card as the back and the true length as the count. Table tucks each
  // one beside its seat.
  const opponentHands = seats.map((_s, i) =>
    i === HUMAN || hands[i].length === 0 ? null : (
      <Hand key={i} cards={hands[i].slice(0, 1)} faceDown count={hands[i].length} size="sm" />
    ),
  )

  const hint = (() => {
    if (phase === 'over') return null
    if (!isHumanTurn) return `Waiting for ${seats[currentPlayer].name}…`
    if (selectedPlay) return canPlaySelection ? `Play your ${label(selectedPlay)}` : `Your ${label(selectedPlay)} won't beat the ${label(current)}`
    if (selectedCards.length) return 'Not a valid combination'
    return current ? `Beat the ${label(current)}, or pass` : 'Your lead — play any combination'
  })()

  return (
    <div className={`flex flex-col ${fill ? 'size-full' : 'w-full items-center gap-4'} ${className}`}>
      {/* relative so the Pass / Play group can float over the hand at the bottom.
          When filling, this grows to take the whole height so the table stretches. */}
      <div className={`relative flex w-full justify-center ${fill ? 'min-h-0 flex-1' : ''}`}>
        {/* In bare mode there's no status line below, so the hint floats as a pill
            near the top of the felt — feedback stays, but nothing hangs off the
            table. Purely presentational, so it never eats a tap (pointer-events). */}
        {/* Anchored top-LEFT, and BELOW the HUD row. Three things compete for the
            top of the felt: the top seat's avatar (centred), the Leave button
            (top-left) and the room pill (top-right) — see TableContainer's HUD. So
            the pill is the only one that can give way: top-14 clears Leave, and
            max-w-42% stops it reaching the centred top seat (46% did, once the text
            was long enough — measured, not eyeballed).
            KNOWN LIMIT: at 6–8 seats the computed seat ring puts a seat in the
            upper-left too, and this pill laps it. No fixed position is clear at
            every seat count — every edge of the felt is spoken for at 8 — so this
            is tuned for 2–4, which is the only range Teang Len has and the common
            case for Kanteal. Same fix as Kanteal's board.
            The comment sits OUT here: inside a `cond && (…)` it is a second
            expression and the build fails. (Hit for the third time in this repo.) */}
        {bare && (state.message || hint) && (
          <div className="pointer-events-none absolute top-14 left-3 z-30 flex max-w-[42%] px-1">
            <span className="max-w-full truncate rounded-full border border-white/15 bg-black/55 px-4 py-1 font-display text-sm text-white/90 [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
              {state.message || hint}
            </span>
          </div>
        )}
        <Table
          fill={fill}
          players={players}
          currentTurn={currentPlayer}
          turnSeconds={phase === 'playing' ? TURN_SECONDS : undefined}
          turnKey={state.turnKey}
          onTurnExpire={() => dispatch({ type: 'timeout' })}
          opponentHands={opponentHands}
          hand={
            <Hand
              cards={handCards}
              selected={selected}
              // Deal reveal (see the reveal machine above): flips up unsorted,
              // then flips again into a sorted hand.
              faceDown={handFaceDown}
              flipMs={handFlipMs}
              flipStagger={handFlipStagger}
              // Always interactive — you can lift/queue cards even when it isn't
              // your turn, so Play is ready the instant the turn comes round.
              // `meta.expand` is Hand's cue to auto-complete a tapped card into a
              // whole combination (OnlineBoard does that). This board has no
              // suggester, so it drops the phase — otherwise the release would
              // re-toggle and undo the press.
              onSelect={(id, meta) => !meta?.expand && dispatch({ type: 'select', id })}
              size="md"
              // Flat row, not a fan — cards sit level (spread/curve 0). `spacing`
              // widens the step so more of each card shows; maxWidth is raised to
              // give that spacing room before it tightens.
              spread={0}
              curve={0}
              spacing={46}
              maxWidth={700}
            />
          }
        >
          {phase === 'over' ? (
            // No results modal — the table stays put and a 60s ring in the centre
            // counts down, then auto-deals the next game. "Start now" skips the wait
            // and deals immediately — same action the ring fires on expiry. The
            // winner is named in the status line below.
            <div className="flex flex-col items-center gap-2 text-center">
              <TurnTimer seconds={60} size="md" onExpire={() => dispatch({ type: 'reset' })} />
              <span className="font-display text-sm text-white/90 [--stroke-color:#1B4E86] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                New game…
              </span>
              <Button variant="green" size="sm" onClick={() => dispatch({ type: 'reset' })}>
                Start now
              </Button>
            </div>
          ) : (
            <TrickPile
              cards={current?.cards ?? []}
              pile={state.beaten}
              size="sm"
              // The live combo flew in from whoever played it (lastPlayer).
              from={SEAT_DIR[state.lastPlayer]}
              emptyText={currentPlayer === HUMAN ? 'Your lead' : `${seats[currentPlayer].name} to lead`}
            />
          )}
        </Table>

        {/* Pass / Play float over the hand's top-centre, only on your turn. The
            bottom offset clears the md cards (~88px) plus a lifted selection, so
            the buttons hover just above the fan instead of covering the ranks —
            it's a dial. z-30 keeps them over the hand (z-20). */}
        {isHumanTurn && (
          <div className="absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3">
            <Button variant="blue" size="sm" outline="navy" disabled={!current} onClick={() => dispatch({ type: 'skip', seat: HUMAN })}>
              Pass
            </Button>
            <Button variant="green" size="sm" disabled={!canPlaySelection} onClick={() => dispatch({ type: 'play', seat: HUMAN, cards: selectedCards })}>
              Play{selectedCards.length ? ` ${selectedCards.length}` : ''}
            </Button>
          </div>
        )}
      </div>

      {/* Status line under the table — the hint while playing, the winner at the
          end, plus a test button to end the match now and watch the countdown.
          Hidden in bare mode (TablePage): there the hint floats on the felt and the
          Finish-game debug button has no place on a real screen. */}
      {!bare && (
        <div className="flex min-h-6 w-full max-w-170 items-center justify-center gap-4 px-2">
          <span className="font-display text-sm text-white/85 [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            {state.message || hint}
          </span>
          {phase === 'playing' && (
            <Button variant="red" size="sm" outline="navy" onClick={() => dispatch({ type: 'finish' })}>
              Finish game
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
