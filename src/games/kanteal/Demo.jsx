import { useEffect, useState } from 'react'
import Table from '../../components/Table/Table.jsx'
import Hand from '../../components/Hand/Hand.jsx'
import Button from '../../components/Button/Button.jsx'
import Centre from './Centre.jsx'
import ChallengeStack from './ChallengeStack.jsx'
import PlayArea from './PlayArea.jsx'
import { canBeat, chooseBotMove, sortCards } from './engine.js'
import { applyCommit, applyPass, applyPlay, applyReveal, createMatch, legalMoves, SUIT_MARK } from './match.js'

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

// Kanteal seats 2–8, and the SEAT COUNT IS SWITCHABLE here on purpose: the felt
// changes layout past four (Table's computed ring), and the play areas switch to a
// tighter overlap with it. Both only misbehave at counts you can't otherwise reach
// without standing up a real room, which is precisely how a crowded-table bug ships.
const NAMES = ['You', 'Sophea', 'Dara', 'Rith', 'Chan', 'Mony', 'Vichea', 'Bopha']
const COIN = [12450, 9800, 3400, 21050, 4200, 7650, 1980, 15300]
const SEAT_COUNTS = [2, 4, 6, 8]
const seatsFor = (n) => NAMES.slice(0, n).map((name, i) => ({ playerId: i === 0 ? 'you' : `b${i}`, name }))

const HUMAN = 0
const BOT_DELAY_MS = 900

const cardLabel = (c) => (c ? `${c.rank}${SUIT_MARK[c.suit]}` : '')

export default function KantealDemo({ fill = false, className = '' }) {
  const [seatCount, setSeatCount] = useState(4)
  const [gs, setGs] = useState(() => createMatch(seatsFor(4)))
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')

  // Bot turns. Keyed on the whole state, so each committed move schedules exactly
  // one follow-up — the same "one move per turn" guarantee Board.jsx gets from
  // turnKey, without needing a ref here because there's no network to race.
  useEffect(() => {
    if (gs.phase !== 'playing') return
    const seat = gs.currentPlayer
    const isReveal = gs.round === 2 // forced for whoever's up — even the human
    if (seat === HUMAN && !isReveal) return
    const t = setTimeout(() => {
      let res
      if (isReveal) {
        res = applyReveal(gs, seat)
      } else {
        const lm = legalMoves(gs, seat)
        const mv = chooseBotMove(gs.hands[seat], gs.table, { mustOpen: lm.mustOpen, mustCommit: lm.mustCommit, faceUpAt: gs.rules?.faceUpAt })
        if (!mv) return
        res = mv.type === 'commit' ? applyCommit(gs, seat, mv) : mv.type === 'pass' && lm.canPass ? applyPass(gs, seat, mv.card) : applyPlay(gs, seat, mv.card)
      }
      if (res?.state) setGs(res.state)
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

  // Final challenge — commit both last cards: picked face-up, the other held.
  function commit() {
    if (!picked) return
    const down = myHand.find((c) => c.id !== picked.id)
    if (!down) return setMessage('Need two cards to commit')
    const res = applyCommit(gs, HUMAN, { upId: picked.id, downId: down.id })
    if (res.error) return setMessage(res.error)
    setMessage('')
    setGs(res.state)
    setSelected(null)
  }

  const SEATS = gs.seats
  const n = SEATS.length

  function deal(count = seatCount) {
    setSeatCount(count)
    setGs(createMatch(seatsFor(count)))
    setSelected(null)
    setMessage('')
  }

  const players = SEATS.map((s, i) => ({
    name: gs.eliminated[i] ? `${s.name} ✕` : s.name,
    coin: COIN[i],
    host: i === HUMAN,
    // §4 — one winner: crown + halo + confetti on that seat at match end (Table).
    winner: over && gs.winner === i,
  }))

  // While playing, opponents show a face-down count; a committed seat shows its
  // stacked pair (public face-up card + hidden peek) nudged left; at match end every
  // seat's REMAINING cards turn face-up — the standard reveal (mirrors Board.jsx).
  const opponentHands = SEATS.map((_, i) => {
    if (i === HUMAN) return null
    if (!over && gs.commits?.[i] != null) {
      const upCard = [...(gs.played[i] ?? [])].reverse().find((e) => e.card)?.card ?? null
      return (
        <div key={i} className="translate-x-[-55%]">
          <ChallengeStack up={upCard} size="sm" />
        </div>
      )
    }
    if (!gs.hands[i].length) return null
    return over ? (
      <Hand key={i} cards={gs.hands[i]} size="xs" spread={0} curve={0} spacing={20} maxWidth={130} />
    ) : (
      <Hand key={i} cards={gs.hands[i].slice(0, 1)} faceDown count={gs.hands[i].length} size="lg" />
    )
  })

  // Played cards stay in front of their owner all game — no central pile.
  const playAreas = SEATS.map((s, i) => (
    <PlayArea
      key={i}
      played={gs.played[i]}
      currentId={gs.table?.id ?? null}
      label={i === HUMAN ? null : s.name}
      dense={n > 4}
    />
  ))

  const hint = (() => {
    // "You wins!" — the local seat is literally named "You", so it needs its own
    // verb rather than the third-person template.
    if (over) return gs.winner == null ? 'Game over' : gs.winner === HUMAN ? '🏆 You win!' : `🏆 ${SEATS[gs.winner].name} wins!`
    if (gs.eliminated[HUMAN]) return '✕ You were cut — watching to the end'
    if (!isMyTurn) return `${SEATS[gs.currentPlayer].name} to play…`
    if (legal.mustReveal) return 'Revealing your held card…'
    if (legal.mustCommit) {
      return picked
        ? `Commit ${cardLabel(picked)} face-up — your other card stays hidden`
        : 'Final two — tap your face-up card; the other is hidden for Round 2'
    }
    if (legal.mustOpen) return 'Open the cycle — play any card'
    if (!picked) return `Beat the ${cardLabel(gs.table)}, or pass a card face-down`
    if (pickedBeats) return `Play ${cardLabel(picked)}`
    return legal.canPass
      ? `${cardLabel(picked)} can't beat — pass it face-down`
      : `${cardLabel(picked)} can't beat — it'll be revealed face-up`
  })()

  return (
    <div className={`relative ${fill ? 'size-full' : ''} ${className}`}>
      {/* Corner fallback for the seconds a §7 challenge owns the felt centre — see
          Board.jsx and Centre.jsx. */}
      {(message || hint) && gs.challenge && (
        <div className="pointer-events-none absolute top-14 left-3 z-30 flex max-w-[42%] px-1">
          <span className="max-w-full truncate rounded-full border border-white/15 bg-black/55 px-4 py-1 font-display text-sm text-white/90 [--stroke-width:0]">
            {message || hint}
          </span>
        </div>
      )}

      {/* Seat-count switcher — workbench only, not part of the game. */}
      <div className="absolute top-3 right-3 z-30 flex gap-1">
        {SEAT_COUNTS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => deal(c)}
            className={`rounded-md border px-2 py-0.5 font-display text-[11px] [--stroke-width:0] ${
              seatCount === c ? 'border-[#9fe03a] bg-[#9fe03a]/20 text-[#c2f051]' : 'border-white/20 bg-black/50 text-white/70'
            }`}
          >
            {c}P
          </button>
        ))}
      </div>

      <Table
        fill={fill}
        players={players}
        currentTurn={over ? -1 : gs.currentPlayer}
        opponentHands={opponentHands}
        playAreas={playAreas}
        hand={
          <Hand
            cards={myHand}
            selected={selected ? [selected] : []}
            onSelect={
              over || gs.eliminated[HUMAN] || legal.mustReveal
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
        <Centre gs={gs} hint={message || hint} />
      </Table>

      <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2">
        {over ? (
          <Button
            variant="lime"
            size="md"
            onClick={() => deal()}
          >
            DEAL
          </Button>
        ) : (
          isMyTurn &&
          !legal.mustReveal && (
            <>
              {legal.mustCommit ? (
                <Button variant="green" size="md" disabled={!picked} onClick={commit}>
                  COMMIT
                </Button>
              ) : (
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
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}
