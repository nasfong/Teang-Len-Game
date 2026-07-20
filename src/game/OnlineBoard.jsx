import { useEffect, useRef, useState } from 'react'
import Table from '../components/Table/Table.jsx'
import Hand from '../components/Hand/Hand.jsx'
import TrickPile from '../components/TrickPile/TrickPile.jsx'
import Button from '../components/Button/Button.jsx'
import { classify, canBeat, label, suggestSelection, DEFAULT_FEATURES } from '../components/GameTable/engine.js'
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

export default function OnlineBoard({ channel, room, waitingText }) {
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

  // Seats rotated so my (or, spectating, the anchor) seat is slot 0 (bottom).
  const players = Array.from({ length: n }, (_, r) => {
    const s = seatSource[abs(r)]
    const info = infoById.get(s.playerId)
    return { name: s.name, host: false, afk: info?.isOnline === false, coin: info?.coin }
  })

  // --- playing-only derived values ---
  const current = playing ? gs.current : null
  const myHand = playing && !isSpectator ? (gs.hands[mySeat] ?? []) : []
  const isMyTurn = playing && !isSpectator && gs.currentPlayer === mySeat

  const opponentHands = Array.from({ length: n }, (_, r) => {
    if (!playing) return null
    if (r === 0 && !isSpectator) return null // my own hand is the face-up one below
    const h = gs.hands[abs(r)]
    return h && h.length ? <Hand key={r} cards={h.slice(0, 1)} faceDown count={h.length} size="sm" /> : null
  })

  const selectedCards = myHand.filter((c) => selected.includes(c.id))
  const selectedPlay = selectedCards.length ? classify(selectedCards, FEATURES) : null
  const canPlaySelection = isMyTurn && selectedPlay && (!current || canBeat(selectedPlay, current, FEATURES))

  // Tapping a card auto-completes the combination it most likely belongs to (the
  // smallest hand that beats the table), so answering a pair/triple/run is ONE tap
  // instead of two-to-five. Manual control is preserved: the auto-pick only fires on
  // the FIRST tap of an empty selection — after that taps add and remove one card at
  // a time, so any suggestion can be adjusted or built by hand.
  function toggle(id) {
    setMessage('')
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id) // deselect
      if (sel.length) return [...sel, id] // adjusting an existing selection
      const tapped = myHand.find((c) => c.id === id)
      const suggestion = isMyTurn ? suggestSelection(myHand, current, tapped, FEATURES) : null
      return suggestion ? suggestion.map((c) => c.id) : [id]
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
        {(message || hint) && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
            <span className="max-w-full truncate rounded-full border border-white/15 bg-black/55 px-4 py-1 font-display text-sm text-white/90 [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
              {message || hint}
            </span>
          </div>
        )}

        <Table
          fill
          players={players}
          currentTurn={playing ? rel(gs.currentPlayer) : -1}
          turnSeconds={playing ? TURN_SECONDS : undefined}
          turnKey={playing ? gs.turnKey : 0}
          opponentHands={opponentHands}
          hand={playing && !isSpectator ? <Hand cards={myHand} selected={selected} onSelect={toggle} size="md" spread={0} curve={0} spacing={46} maxWidth={700} /> : null}
        >
          {playing ? (
            <TrickPile
              cards={current?.cards ?? []}
              pile={gs.beaten}
              size="sm"
              from={SEAT_DIR[rel(gs.lastPlayer)]}
              emptyText={gs.currentPlayer === mySeat ? 'Your lead' : `${gs.seats[gs.currentPlayer].name} to lead`}
            />
          ) : (
            // Countdown / waiting message in the centre of the felt.
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="font-display text-base text-white [--stroke-color:#1B4E86] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                {waitingText}
              </span>
            </div>
          )}
        </Table>

        {isMyTurn && (
          <div className="absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3">
            <Button variant="blue" size="sm" outline="navy" disabled={!current} onClick={pass}>
              Pass
            </Button>
            <Button variant="green" size="sm" disabled={!canPlaySelection} onClick={playCards}>
              Play{selectedCards.length ? ` ${selectedCards.length}` : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
