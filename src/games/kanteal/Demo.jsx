import { useEffect, useState } from 'react'
import Table from '../../components/Table/Table.jsx'
import Hand from '../../components/Hand/Hand.jsx'
import Button from '../../components/Button/Button.jsx'
import Centre from './Centre.jsx'
import { canBeat, chooseBotMove, sortCards } from './engine.js'
import { applyPass, applyPlay, createMatch, legalMoves, SUIT_MARK } from './match.js'

// Kanteal, playable single-player against three bots — the gallery counterpart to
// GameTable, and the ONLY way to actually look at this game without standing up a
// four-client multiplayer room.
//
// That's the point: verify.mjs proves the RULES, but nothing proved the SCREEN. The
// §7 challenge card, the face-up reveal row and the elimination marker are all
// states a real match reaches rarely and late, so they'd otherwise ship unseen.
//
// The bots are a demo stand-in. The real game is peer-authoritative multiplayer
// (see Board.jsx); everything below is wiring and presentation over the same pure
// engine, with no rules of its own.

const SEATS = [
  { playerId: 'you', name: 'You' },
  { playerId: 'b1', name: 'Sophea' },
  { playerId: 'b2', name: 'Dara' },
  { playerId: 'b3', name: 'Rith' },
]
const HUMAN = 0
const BOT_DELAY_MS = 900
const COIN = [12450, 9800, 3400, 21050]

const cardLabel = (c) => (c ? `${c.rank}${SUIT_MARK[c.suit]}` : '')

export default function KantealDemo({ fill = false, className = '' }) {
  const [gs, setGs] = useState(() => createMatch(SEATS))
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')

  // Bot turns. Keyed on the whole state, so each committed move schedules exactly
  // one follow-up — the same "one move per turn" guarantee Board.jsx gets from
  // turnKey, without needing a ref here because there's no network to race.
  useEffect(() => {
    if (gs.phase !== 'playing' || gs.currentPlayer === HUMAN) return
    const t = setTimeout(() => {
      const seat = gs.currentPlayer
      const lm = legalMoves(gs, seat)
      const mv = chooseBotMove(gs.hands[seat], gs.table, { mustOpen: lm.mustOpen, faceUpAt: gs.rules?.faceUpAt })
      if (!mv) return
      const res = mv.type === 'pass' && lm.canPass ? applyPass(gs, seat, mv.card) : applyPlay(gs, seat, mv.card)
      if (res.state) setGs(res.state)
    }, BOT_DELAY_MS)
    return () => clearTimeout(t)
  }, [gs])

  const over = gs.phase === 'over'
  const myHand = sortCards(gs.hands[HUMAN])
  const isMyTurn = !over && gs.currentPlayer === HUMAN && !gs.eliminated[HUMAN]
  const legal = legalMoves(gs, HUMAN)
  const picked = myHand.find((c) => c.id === selected) ?? null
  const pickedBeats = picked ? (legal.mustOpen ? true : canBeat(picked, gs.table)) : false

  function act(fn) {
    const res = fn(gs, HUMAN, picked)
    if (res.error) return setMessage(res.error)
    setMessage('')
    setGs(res.state)
    setSelected(null)
  }

  const players = SEATS.map((s, i) => ({
    name: gs.eliminated[i] ? `${s.name} ✕` : s.name,
    coin: COIN[i],
    host: i === HUMAN,
  }))

  const opponentHands = SEATS.map((_, i) =>
    i === HUMAN || !gs.hands[i].length ? null : (
      <Hand key={i} cards={gs.hands[i].slice(0, 1)} faceDown count={gs.hands[i].length} size="sm" />
    ),
  )

  const hint = (() => {
    if (over) return gs.winner != null ? `🏆 ${SEATS[gs.winner].name} wins!` : 'Game over'
    if (gs.eliminated[HUMAN]) return '✕ You were cut — watching to the end'
    if (!isMyTurn) return `${SEATS[gs.currentPlayer].name} to play…`
    if (legal.mustOpen) return 'You won the cycle — open with any card'
    if (!picked) return `Beat the ${cardLabel(gs.table)}, or pass a card face-down`
    if (pickedBeats) return `Play ${cardLabel(picked)}`
    return legal.canPass
      ? `${cardLabel(picked)} can't beat — pass it face-down`
      : `${cardLabel(picked)} can't beat — it'll be revealed face-up`
  })()

  return (
    <div className={`relative ${fill ? 'size-full' : ''} ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
        <span className="max-w-full truncate rounded-full border border-white/15 bg-black/55 px-4 py-1 font-display text-sm text-white/90 [--stroke-width:0]">
          {message || hint}
        </span>
      </div>

      <Table
        fill={fill}
        players={players}
        currentTurn={over ? -1 : gs.currentPlayer}
        opponentHands={opponentHands}
        hand={
          <Hand
            cards={myHand}
            selected={selected ? [selected] : []}
            onSelect={
              over || gs.eliminated[HUMAN]
                ? undefined
                : (id, meta) => {
                    if (meta?.expand) return // one card per turn — no combos
                    setMessage('')
                    setSelected((cur) => (cur === id ? null : id))
                  }
            }
            size="md"
            spread={0}
            curve={0}
            spacing={52}
            maxWidth={700}
          />
        }
      >
        <Centre gs={gs} />
      </Table>

      <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2">
        {over ? (
          <Button
            variant="lime"
            size="md"
            onClick={() => {
              setGs(createMatch(SEATS))
              setSelected(null)
              setMessage('')
            }}
          >
            DEAL
          </Button>
        ) : (
          isMyTurn && (
            <>
              {/* §5 — Pass disappears entirely at the threshold rather than greying
                  out, because it's gone for the rest of the game. */}
              {legal.canPass && (
                <Button variant="red" size="md" disabled={!picked} onClick={() => act(applyPass)}>
                  PASS
                </Button>
              )}
              <Button
                variant="green"
                size="md"
                disabled={!picked || !legal.canPlay.some((c) => c.id === picked.id)}
                onClick={() => act(applyPlay)}
              >
                PLAY
              </Button>
            </>
          )
        )}
      </div>
    </div>
  )
}
