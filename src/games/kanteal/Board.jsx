import { useEffect, useRef, useState } from 'react'
import Table from '../../components/Table/Table.jsx'
import Hand from '../../components/Hand/Hand.jsx'
import Button from '../../components/Button/Button.jsx'
import { canBeat, chooseBotMove, FACE_UP_AT, sortCards } from './engine.js'
import { applyPass, applyPlay, deriveFlags, legalMoves, mySeatIndex, SUIT_MARK } from './match.js'
import Centre from './Centre.jsx'

// Kanteal's in-room screen. Structurally a sibling of Teang Len's Board — same seat
// rotation, spectator view and AFK bot driver, because those belong to the ROOM, not
// to the game — but everything inside the felt is Kanteal's:
//
//   • ONE card is played per turn, so the hand is single-select, not a combo builder.
//   • Both buttons act on the SAME selected card. Passing means discarding a card
//     face-down (§3), so the player must choose which — it isn't a bare "pass".
//   • The centre shows the table card, the §7 challenge, and any face-up reveals.
//
// A game's Board owns its whole screen precisely so this can differ freely.

const TURN_SECONDS = 20

const cardLabel = (c) => (c ? `${c.rank}${SUIT_MARK[c.suit]}` : '')

export default function KantealBoard({ channel, room, waitingText }) {
  const playerId = channel.playerId
  // Fall back to the room snapshot so someone arriving mid-game sees it at once.
  const gs = channel.game?.gameState ?? room?.gameState
  const playing = room?.status === 'playing' && Boolean(gs)

  const [selected, setSelected] = useState(null) // one card id, or null
  const [message, setMessage] = useState('')

  const latest = useRef(gs)
  latest.current = gs

  // Emit a computed state. Kanteal always uses `play` (never `skip`) even for a pass:
  // a pass mutates the hand and can END the game outright via the §6 cut leaving one
  // player standing, and only the play event carries the gameOver/rankings flags.
  const send = (state, seat, actingId = null) => {
    const flags = deriveFlags(state)
    if (actingId) channel.playAs(actingId, state, flags)
    else channel.play(state, flags)
  }

  // Turn timeout — take the seat's move automatically so a stalled player can't hold
  // the table. A legal move always exists (§5 guarantees it).
  useEffect(() => {
    if (channel.timeoutCount === 0) return
    const s = latest.current
    if (!s || s.phase !== 'playing') return
    const seat = mySeatIndex(s, playerId)
    if (s.currentPlayer !== seat) return
    const lm = legalMoves(s, seat)
    const mv = chooseBotMove(s.hands[seat], s.table, { mustOpen: lm.mustOpen, faceUpAt: s.rules?.faceUpAt })
    if (!mv) return
    const res = mv.type === 'pass' && lm.canPass ? applyPass(s, seat, mv.card) : applyPlay(s, seat, mv.card)
    if (res.state) send(res.state, seat)
    setSelected(null)
  }, [channel.timeoutCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const seatSource = playing
    ? gs.seats
    : [...(room?.players ?? [])]
        .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
        .map((p) => ({ playerId: p.playerId, name: p.name }))

  const n = seatSource.length
  const mySeat = seatSource.findIndex((s) => s.playerId === playerId)
  const isSpectator = mySeat < 0
  const anchor = isSpectator ? 0 : mySeat

  const infoById = new Map((room?.players ?? []).map((p) => [p.playerId, p]))
  const isOnlineId = (id) => infoById.get(id)?.isOnline !== false

  // Bot driver — the lowest ONLINE seat covers an offline player's turn so a
  // disconnect never stalls the table. Emitted AS that seat so the server credits
  // the right player.
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
      const lm = legalMoves(s, turnSeat)
      const mv = chooseBotMove(s.hands[turnSeat], s.table, { mustOpen: lm.mustOpen, faceUpAt: s.rules?.faceUpAt })
      if (!mv) return
      const res = mv.type === 'pass' && lm.canPass ? applyPass(s, turnSeat, mv.card) : applyPlay(s, turnSeat, mv.card)
      if (res.state) send(res.state, turnSeat, actingId)
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

  const rel = (absSeat) => (absSeat - anchor + n) % n
  const abs = (r) => (anchor + r) % n

  const over = Boolean(gs) && gs.phase === 'over'
  const showHands = playing || over

  const players = Array.from({ length: n }, (_, r) => {
    const s = seatSource[abs(r)]
    const info = infoById.get(s.playerId)
    const cut = showHands && gs.eliminated?.[abs(r)]
    return {
      // §6 — a cut player stays visible but is marked, so the table can see why they
      // are being skipped rather than wondering if the game is stuck.
      name: cut ? `${s.name} ✕` : s.name,
      host: false,
      afk: info?.isOnline === false,
      coin: info?.coin,
    }
  })

  const myHand = showHands && !isSpectator ? (gs.hands[mySeat] ?? []) : []
  const sortedHand = sortCards(myHand)
  const isMyTurn = playing && !isSpectator && gs.currentPlayer === mySeat && !gs.eliminated[mySeat]
  const legal = playing && !isSpectator ? legalMoves(gs, mySeat) : { canPlay: [], canPass: false, mustOpen: false }
  const picked = sortedHand.find((c) => c.id === selected) ?? null
  const pickedBeats = picked ? (legal.mustOpen ? true : canBeat(picked, gs?.table)) : false
  const canPlayPicked = isMyTurn && picked && legal.canPlay.some((c) => c.id === picked.id)
  const canPassPicked = isMyTurn && picked && legal.canPass

  // Opponents' hands are face-down counts. §3/§6 keep every discarded and dropped
  // card hidden, so a count is the ONLY thing that may be shown here.
  const opponentHands = Array.from({ length: n }, (_, r) => {
    if (!showHands) return null
    if (r === 0 && !isSpectator) return null
    const h = gs.hands[abs(r)]
    if (!h || !h.length) return null
    return <Hand key={r} cards={h.slice(0, 1)} faceDown count={h.length} size="sm" />
  })

  function pick(id, meta) {
    if (meta?.expand) return // no combos in Kanteal — one card per turn
    setMessage('')
    setSelected((cur) => (cur === id ? null : id))
  }

  function doPlay() {
    const res = applyPlay(gs, mySeat, picked)
    if (res.error) return setMessage(res.error)
    send(res.state, mySeat)
    setSelected(null)
  }

  function doPass() {
    const res = applyPass(gs, mySeat, picked)
    if (res.error) return setMessage(res.error)
    send(res.state, mySeat)
    setSelected(null)
  }

  const hint = (() => {
    if (isSpectator) return playing ? `👁 Spectating — ${gs.seats[gs.currentPlayer].name} to play` : '👁 Spectating'
    if (!playing) return null
    if (over) return gs.winner != null ? `🏆 ${gs.seats[gs.winner].name} wins!` : 'Game over'
    if (gs.eliminated[mySeat]) return '✕ You were cut — watching to the end'
    if (!isMyTurn) return `Waiting for ${gs.seats[gs.currentPlayer].name}…`
    if (legal.mustOpen) return 'You won the cycle — open with any card'
    if (!picked) return `Beat the ${cardLabel(gs.table)}, or pass a card face-down`
    if (pickedBeats) return `Play ${cardLabel(picked)}`
    // §5 — below the threshold an unbeatable card must be discarded; at it, the card
    // is played face-up anyway and simply wins nothing.
    return myHand.length <= FACE_UP_AT
      ? `${cardLabel(picked)} can't beat — it'll be revealed face-up`
      : `${cardLabel(picked)} can't beat — pass it face-down`
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
          currentTurn={playing && !over ? rel(gs.currentPlayer) : -1}
          turnSeconds={playing && !over ? TURN_SECONDS : undefined}
          turnKey={playing ? gs.turnKey : 0}
          opponentHands={opponentHands}
          hand={
            showHands && !isSpectator ? (
              <Hand
                cards={sortedHand}
                selected={selected ? [selected] : []}
                onSelect={over || gs.eliminated[mySeat] ? undefined : pick}
                size="md"
                spread={0}
                curve={0}
                spacing={52}
                maxWidth={700}
              />
            ) : null
          }
        >
          {playing ? (
            <Centre gs={gs} />
          ) : (
            <span className="rounded-2xl border border-white/15 bg-black/55 px-4 py-2 text-center font-display text-sm text-white/85 [--stroke-width:0]">
              {waitingText}
            </span>
          )}
        </Table>

        {/* Controls. Both act on the SAME selected card — passing is a face-down
            DISCARD (§3), so it needs a card chosen just as playing does. */}
        {isMyTurn && !over && (
          <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2">
            <Button
              variant="red"
              size="md"
              sizeTall="lg"
              disabled={!canPassPicked}
              onClick={doPass}
              // §5 — the option disappears entirely at the threshold rather than
              // sitting there greyed out, because it is gone for the rest of the game.
              className={legal.canPass ? '' : 'hidden'}
            >
              PASS
            </Button>
            <Button variant="green" size="md" sizeTall="lg" disabled={!canPlayPicked} onClick={doPlay}>
              PLAY
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
