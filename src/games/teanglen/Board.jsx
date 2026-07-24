import { useEffect, useRef, useState } from 'react'
import Table from '../../components/Table/Table.jsx'
import Hand from '../../components/Hand/Hand.jsx'
import TrickPile from '../../components/TrickPile/TrickPile.jsx'
import Button from '../../components/Button/Button.jsx'
import { classify, canBeat, label, suggestSelection, DEFAULT_FEATURES } from './engine.js'
import { applyPlay, applySkip, deriveFlags, mySeatIndex, lowestCard } from './match.js'

// OnlineBoard — the networked table, ALWAYS on screen (lobby and gameplay are the
// same place). Before the deal it shows the felt with the seated players and a
// countdown in the centre; once the game starts it renders the authoritative
// gameState relayed over the socket (channel.game.gameState) from MY point of view
// (my seat rotated to the bottom) and lets me act ONLY on my turn.
//
// A move is computed locally (match.js) and emitted (channel.play / channel.skip);
// the server relays it back as game:update, which is what re-renders — one source
// of truth. No bots, no self-deal: every other seat is a real player. On a
// turn:timeout the ACTING client (only) auto-plays its lowest card / passes.

const FEATURES = DEFAULT_FEATURES
const TURN_SECONDS = 15
const SEAT_DIR = ['bottom', 'right', 'top', 'left']

// When a trick resolves (everyone passed), the match nulls `current` at once — it
// must, since the winner now owes a fresh lead. But blanking the felt the instant
// the last pass lands robs the table of the moment: nobody sees the combo that took
// the trick. So the VIEW holds the last trick on the felt for this long before
// sweeping it to empty, the way a real table — and every polished Teang Len client —
// does. A new lead supersedes the hold immediately, so it never delays real play.
const TRICK_HOLD_MS = 1400

/**
 * The trick to DISPLAY, which lags the match state by a sweep delay: it mirrors
 * `gs.current` while a combo is live, but when the trick resolves (current → null)
 * it keeps the winning combo up for TRICK_HOLD_MS, then clears. Returns
 * { cards, pile, fromSeat } for TrickPile (fromSeat is absolute; caller rel()s it).
 * View-only — game logic still reads the real `gs.current`.
 */
function useHeldTrick(gs) {
  const [display, setDisplay] = useState(() => {
    const cur = gs?.phase === 'playing' ? gs.current : null
    return { cards: cur?.cards ?? [], pile: gs?.beaten ?? [], fromSeat: gs?.lastPlayer ?? 0 }
  })
  const shown = useRef(display.cards.length > 0)
  const timer = useRef(null)

  useEffect(() => {
    const current = gs?.phase === 'playing' ? gs.current : null
    const cancel = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
    if (current) {
      // A combo is on the table — show it now, and drop any pending sweep (this is a
      // fresh lead landing during the hold, or an ordinary answer).
      cancel()
      shown.current = true
      setDisplay({ cards: current.cards, pile: gs.beaten, fromSeat: gs.lastPlayer })
    } else if (shown.current) {
      // Trick just resolved — keep the winning combo visible, then sweep to empty.
      cancel()
      timer.current = setTimeout(() => {
        timer.current = null
        shown.current = false
        setDisplay((d) => ({ ...d, cards: [], pile: [] }))
      }, TRICK_HOLD_MS)
    }
    return cancel
  }, [gs])

  return display
}

// The match ends the instant the final card lands. Everyone's hands drop face-up at
// once so the table reads the final position immediately — but the WINNER moment
// (banner + medals + crown + confetti) waits this long, so the deciding card and the
// freshly-revealed hands register before "X wins!" pops. This is the END-of-game
// hold; TRICK_HOLD_MS is the shorter between-tricks sweep.
const REVEAL_DELAY_MS = 2600

/** `true` REVEAL_DELAY_MS after `over` turns true; back to `false` at once when it
 *  clears (a new deal). Gates ONLY the winner banner + celebration — the hand reveal
 *  is immediate (keyed on `over`). */
function useDelayedReveal(over) {
  const [revealing, setRevealing] = useState(false)
  useEffect(() => {
    if (!over) {
      setRevealing(false)
      return
    }
    const t = setTimeout(() => setRevealing(true), REVEAL_DELAY_MS)
    return () => clearTimeout(t)
  }, [over])
  return revealing
}

export default function OnlineBoard({ channel, room, waitingText, waitingAction = null }) {
  const playerId = channel.playerId
  // Fall back to the room snapshot's persisted gameState so someone who arrives
  // mid-game (a spectator, or a player who took a seat mid-hand) sees the game in
  // progress right away — before the next game:update reaches them.
  const gs = channel.game?.gameState ?? room?.gameState
  const playing = room?.status === 'playing' && Boolean(gs)

  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState('')

  // Latest state in a ref so the timeout handler (keyed only on timeoutCount) never
  // acts on a stale closure.
  const latest = useRef(gs)
  latest.current = gs

  // What the felt shows — lags the state by a sweep delay so a won trick lingers
  // before it clears (see useHeldTrick). View-only; logic still uses the real gs.
  const heldTrick = useHeldTrick(gs)

  // Game over is instant, and so is the hand reveal (keyed on `over`): every seat's
  // remaining cards drop face-up right away. `revealing` lags it by REVEAL_DELAY_MS
  // and gates ONLY the winner banner + avatar medals/crown/confetti, so the deciding
  // card and the revealed hands land a beat before "X wins!" (see useDelayedReveal).
  const over = Boolean(gs) && gs.phase === 'over'
  const revealing = useDelayedReveal(over)

  useEffect(() => {
    if (channel.timeoutCount === 0) return
    const s = latest.current
    if (!s || s.phase !== 'playing') return
    const seat = mySeatIndex(s, playerId)
    if (s.currentPlayer !== seat) return
    const res = s.current ? applySkip(s, seat) : applyPlay(s, seat, [lowestCard(s.hands[seat])])
    if (res.state) {
      if (s.current) channel.skip(res.state)
      else channel.play(res.state, deriveFlags(res.state, seat))
    }
    setSelected([])
  }, [channel.timeoutCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seat source: the live game while playing, else the room's seated players so the
  // table + seats show during the countdown.
  const seatSource = playing
    ? gs.seats
    : [...(room?.players ?? [])]
        .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
        .map((p) => ({ playerId: p.playerId, name: p.name }))

  const n = seatSource.length
  const mySeat = seatSource.findIndex((s) => s.playerId === playerId)
  // Not among the seats → I'm a SPECTATOR: I joined a full room, or I took a seat
  // mid-game and I'm sitting out the current hand. I watch from the anchor seat's
  // angle with every hand face-down and no controls.
  const isSpectator = mySeat < 0
  const anchor = isSpectator ? 0 : mySeat

  // Per-seat info by playerId: the online flag drives the AFK badge + bot takeover,
  // and coin shows under the seat.
  const infoById = new Map((room?.players ?? []).map((p) => [p.playerId, p]))
  const isOnlineId = (id) => infoById.get(id)?.isOnline !== false

  // Bot driver: when the seat to move is OFFLINE, the lowest ONLINE seat in the match
  // plays a passive move for them after a short beat, so a disconnect never stalls the
  // table. Emitted AS that seat (playAs) so the server credits the right player. If the
  // driver itself drops, a room:update re-elects the next online seat.
  const turnSeat = playing ? gs.currentPlayer : -1
  const turnOffline = playing && !isOnlineId(gs.seats[turnSeat]?.playerId)
  const driverSeat = playing ? gs.seats.findIndex((s) => isOnlineId(s.playerId)) : -1
  const amBotDriver = turnOffline && driverSeat === mySeat
  const turnKey = playing ? gs.turnKey : null

  const botTurnRef = useRef(null)
  useEffect(() => {
    if (!amBotDriver) return
    if (botTurnRef.current === turnKey) return // one bot move per turn
    botTurnRef.current = turnKey
    const t = setTimeout(() => {
      const s = latest.current
      if (!s || s.phase !== 'playing' || s.currentPlayer !== turnSeat) return
      const actingId = s.seats[turnSeat].playerId
      const res = s.current ? applySkip(s, turnSeat) : applyPlay(s, turnSeat, [lowestCard(s.hands[turnSeat])])
      if (!res.state) return
      if (s.current) channel.skipAs(actingId, res.state)
      else channel.playAs(actingId, res.state, deriveFlags(res.state, turnSeat))
    }, 1400)
    return () => clearTimeout(t)
  }, [amBotDriver, turnKey, turnSeat]) // eslint-disable-line react-hooks/exhaustive-deps

  if (n === 0) {
    return (
      <div className="flex size-full items-center justify-center">
        <span className="font-display text-lg text-white/80 [--stroke-width:0]">Loading table…</span>
      </div>
    )
  }

  const rel = (absSeat) => (absSeat - anchor + n) % n // absolute seat → my-perspective slot
  const abs = (r) => (anchor + r) % n

  // Match-end coin change per player, from the server's settlement (game:end).
  const deltaById = new Map((channel.settlements ?? []).map((x) => [x.playerId, x.delta]))

  // Seats rotated so my (or, spectating, the anchor) seat is slot 0 (bottom).
  const players = Array.from({ length: n }, (_, r) => {
    const s = seatSource[abs(r)]
    const info = infoById.get(s.playerId)
    // At match end, each seat wears its finish PLACE on the avatar (Table maps the
    // number to 🥇🥈🥉/#n) and the 1st-place seat gets the winner crown + halo +
    // confetti. gs.ranked lists seats in finish order, so place = its index + 1.
    // Keyed on `revealing`, not `over`, so the badges + celebration arrive WITH the
    // reveal, after the final-card pause — not the instant the game ends.
    const place = revealing ? gs.ranked.indexOf(abs(r)) + 1 : 0
    const delta = deltaById.get(s.playerId) ?? 0
    // Hold the PRE-settlement balance until the reveal, so the coin rolls up/down at
    // the same beat the +/− chip appears — not 2.6s earlier when room:update landed.
    // game:end + room:update arrive in one burst, so info.coin is already the new
    // balance here; subtracting the delta recovers the old one to roll FROM.
    const coin = over && !revealing && info?.coin != null ? info.coin - delta : info?.coin
    return {
      name: s.name,
      host: false,
      afk: info?.isOnline === false,
      coin,
      rank: place > 0 ? place : null,
      winner: place === 1,
      // The +/− coins, shown with the reveal alongside the placements.
      coinDelta: revealing ? (delta || null) : null,
    }
  })

  // The match holds in `over` for the results countdown before the next deal. Once
  // the reveal fires, every seat's REMAINING cards turn FACE UP beside their profile
  // so the table can see what everyone was left holding — the standard reveal most
  // online card games do. The final state still carries those hands (a player who
  // went out has an empty one), so nothing extra has to be relayed. Hands stay on
  // screen from the moment the game ends (`over`), so nothing blanks during the wait.
  const showHands = playing || over

  // --- playing-only derived values ---
  const current = playing ? gs.current : null
  const myHand = showHands && !isSpectator ? (gs.hands[mySeat] ?? []) : []
  // No turn once the game is over — even in the brief window where the room still
  // reads 'playing' before its status update lands.
  const isMyTurn = playing && !over && !isSpectator && gs.currentPlayer === mySeat

  // The trick on the felt: the lingering held trick during play, and the DECIDING
  // final combo held up through the end-of-game pause (gs.current still holds it at
  // 'over' in both end paths — a last card played, or an all-pass that left one
  // player standing) until the reveal takes the centre.
  const finalTrick = over
    ? { cards: gs.current?.cards ?? [], pile: gs.beaten ?? [], fromSeat: gs.lastPlayer ?? 0 }
    : heldTrick

  const opponentHands = Array.from({ length: n }, (_, r) => {
    if (!showHands) return null
    // My own seat (slot 0): while PLAYING my hand is the interactive fan on the
    // front rim, so nothing sits beside the seat. At match end that fan is gone —
    // so my leftovers are dropped face-up in front of my profile like everyone
    // else's reveal (Table lands slot 0 at OPP_HAND_POS.bottom). The winner's empty
    // hand falls through the length check below, so only players still holding
    // cards — the losers / last places — show a reveal.
    if (r === 0 && !isSpectator && !over) return null
    const h = gs.hands[abs(r)]
    if (!h || !h.length) return null
    // Revealed the instant the game ends (`over`): the whole remaining hand, face up
    // and flat so it reads at a glance in the small slot beside the seat. Playing:
    // one back with a count badge.
    return over ? (
      <Hand key={r} cards={h} size="sm" spread={0} curve={0} spacing={22} maxWidth={300} />
    ) : (
      <Hand key={r} cards={h.slice(0, 1)} faceDown count={h.length} size="sm" />
    )
  })

  const selectedCards = myHand.filter((c) => selected.includes(c.id))
  const selectedPlay = selectedCards.length ? classify(selectedCards, FEATURES) : null
  const canPlaySelection = isMyTurn && selectedPlay && (!current || canBeat(selectedPlay, current, FEATURES))

  // Tapping a card auto-completes the combination it most likely belongs to (the
  // smallest hand that beats the table), so answering a pair/triple/run is ONE tap
  // instead of two-to-five. Manual control is preserved: the auto-pick only fires on
  // a tap that started from an EMPTY selection — after that taps add and remove one
  // card at a time, so any suggestion can be adjusted or built by hand.
  //
  // It arrives in two phases because Hand commits the pressed card on POINTERDOWN,
  // before it can know whether the gesture is a tap or the start of a sweep:
  //   press   → the card alone lifts, instantly (meta.sweep — taken literally)
  //   release → meta.expand, and only then do its partners join it
  // Growing the selection under a finger that turned out to be sweeping would fight
  // the player, so the expansion waits until the gesture is known.
  function toggle(id, meta) {
    setMessage('')
    setSelected((sel) => {
      if (meta?.expand) {
        // Only expand a lone freshly-pressed card. If the player has been building a
        // selection by hand, or that press was a deselect, leave it exactly as it is.
        if (sel.length !== 1 || sel[0] !== id) return sel
        const tapped = myHand.find((c) => c.id === id)
        const suggestion = isMyTurn ? suggestSelection(myHand, current, tapped, FEATURES) : null
        return suggestion ? suggestion.map((c) => c.id) : sel
      }
      if (sel.includes(id)) return sel.filter((x) => x !== id) // deselect
      return [...sel, id]
    })
  }
  function playCards() {
    const res = applyPlay(gs, mySeat, selectedCards)
    if (res.error) return setMessage(res.error)
    channel.play(res.state, deriveFlags(res.state, mySeat))
    setSelected([])
  }
  function pass() {
    const res = applySkip(gs, mySeat)
    if (res.error) return setMessage(res.error)
    channel.skip(res.state)
    setSelected([])
  }

  const hint = (() => {
    if (over) return null // the felt is showing the final card / reveal, not a turn hint
    if (isSpectator) return playing ? `👁 Spectating — ${gs.seats[gs.currentPlayer].name} to play` : '👁 Spectating'
    if (!playing) return null
    if (!isMyTurn) return `Waiting for ${gs.seats[gs.currentPlayer].name}…`
    if (selectedPlay) return canPlaySelection ? `Play your ${label(selectedPlay)}` : `Your ${label(selectedPlay)} won't beat the ${label(current)}`
    if (selectedCards.length) return 'Not a valid combination'
    return current ? `Beat the ${label(current)}, or pass` : 'Your lead — play any combination'
  })()

  return (
    <div className="flex size-full flex-col">
      <div className="relative flex min-h-0 w-full flex-1 justify-center">
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
        {(message || hint) && (
          <div className="pointer-events-none absolute top-14 left-3 z-30 flex max-w-[42%] px-1">
            <span className="max-w-full truncate rounded-full border border-white/15 bg-black/55 px-4 py-1 font-display text-sm text-white/90 [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
              {message || hint}
            </span>
          </div>
        )}

        <Table
          fill
          players={players}
          currentTurn={playing && !over ? rel(gs.currentPlayer) : -1}
          turnSeconds={playing && !over ? TURN_SECONDS : undefined}
          turnKey={playing ? gs.turnKey : 0}
          opponentHands={opponentHands}
          hand={
            playing && !over && !isSpectator ? (
              // Only while PLAYING. The instant the game ends my fan is replaced by my
              // leftovers dropped face-up in front of my profile, like everyone else's
              // reveal (opponentHands slot 0 → Table's OPP_HAND_POS.bottom).
              <Hand
                cards={myHand}
                selected={selected}
                onSelect={toggle}
                size="md"
                spread={0}
                curve={0}
                // Step between cards (the card itself is 64px), so this IS the
                // exposed strip of every card but the last. Tightened from 46 so the
                // hand reads as a held fan rather than a spread-out row. Don't go
                // much below this: the strip is also the tap target, and once it
                // drops far under ~36px, adjacent cards start stealing each other's
                // taps on a phone.
                spacing={52}
                maxWidth={700}
              />
            ) : null
          }
        >
          {revealing ? (
            // Placements now sit on each avatar (Table's rank badges), so the felt
            // centre only needs a slim result line + the next-game countdown — no
            // standings box crowding the reveal. gs.ranked[0] is the winner.
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="rounded-full border border-[#FFD27A]/50 bg-black/60 px-4 py-1.5 font-display text-sm text-[#FFD27A] [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                🏆 {gs.seats[gs.ranked[0]]?.name} wins!
              </span>
              {waitingText && (
                <span className="font-display text-xs text-white/85 [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                  {waitingText}
                </span>
              )}
             {waitingAction}</div>
          ) : playing || over ? (
            // The trick pile — through play (the lingering held trick) AND the
            // end-of-game pause, where it holds the DECIDING final combo on the felt
            // until the reveal above takes over.
            <TrickPile
              cards={finalTrick.cards}
              pile={finalTrick.pile}
              size="sm"
              from={SEAT_DIR[rel(finalTrick.fromSeat)]}
              emptyText={gs.currentPlayer === mySeat ? 'Your lead' : `${gs.seats[gs.currentPlayer].name} to lead`}
            />
          ) : (
            // Countdown / waiting message in the centre of the felt, with the host's
            // "Start now" (waitingAction) stacked directly beneath it.
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="font-display text-base text-white [--stroke-color:#1B4E86] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                {waitingText}
              </span>
              {waitingAction}
            </div>
          )}
        </Table>

        {/* The two turn actions, centred above the hand. Red PASS / green PLAY is
            the convention across this family of games and reads instantly without
            being read. Sized md on a phone (≈132×42px, matching the proportions
            these games use) and lg on a desktop — they're the only controls during a
            turn, so they should be the easiest thing on screen to hit. */}
        {isMyTurn && (
          <div className="absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4">
            <Button variant="red" size="md" sizeTall="lg" outline="navy" disabled={!current} onClick={pass}>
              PASS
            </Button>
            <Button variant="green" size="md" sizeTall="lg" outline="navy" disabled={!canPlaySelection} onClick={playCards}>
              PLAY{selectedCards.length ? ` ${selectedCards.length}` : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
