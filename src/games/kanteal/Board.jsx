import { useEffect, useRef, useState } from 'react'
import Table from '../../components/Table/Table.jsx'
import Hand from '../../components/Hand/Hand.jsx'
import Button from '../../components/Button/Button.jsx'
import PhaseBanner from '../../components/PhaseBanner/PhaseBanner.jsx'
import { canBeat, chooseBotMove, FACE_UP_AT, sortCards } from './engine.js'
import { applyCommit, applyPass, applyPlay, applyReveal, deriveFlags, legalMoves, mySeatIndex, SUIT_MARK } from './match.js'
import Centre from './Centre.jsx'
import ChallengeStack from './ChallengeStack.jsx'
import PlayArea from './PlayArea.jsx'

// A bot/timeout move for `seat` in the given state → the applied result (or null).
// Covers all four move kinds: a Round-2 reveal is forced; a two-card commit picks
// the face-up card; otherwise it's a normal play/pass.
function autoMove(state, seat) {
  const lm = legalMoves(state, seat)
  if (lm.mustReveal) return applyReveal(state, seat)
  const mv = chooseBotMove(state.hands[seat], state.table, {
    mustOpen: lm.mustOpen,
    mustCommit: lm.mustCommit,
    faceUpAt: state.rules?.faceUpAt,
  })
  if (!mv) return null
  if (mv.type === 'commit') return applyCommit(state, seat, mv)
  return mv.type === 'pass' && lm.canPass ? applyPass(state, seat, mv.card) : applyPlay(state, seat, mv.card)
}

// Kanteal's in-room screen. Structurally a sibling of Teang Len's Board — same seat
// rotation, spectator view and AFK bot driver, because those belong to the ROOM, not
// to the game — but everything inside the felt is Kanteal's:
//
//   • ONE card is played per turn, so the hand is single-select, not a combo builder.
//   • Both buttons act on the SAME selected card. Passing means discarding a card
//     face-down (§3), so the player must choose which — it isn't a bare "pass".
//   • THERE IS NO CENTRAL PILE. Every card played stays in front of the player who
//     played it, all game, exactly as it would on a real table (PlayArea.jsx). The
//     felt's centre carries only the §7 challenge, and usually nothing at all.
//
// A game's Board owns its whole screen precisely so this can differ freely.

const TURN_SECONDS = 20

// A finalist plays four cards, then commits the last two — so `played` entries beyond
// the fourth are its final-challenge pair. Every card leaving a hand pushes one entry,
// so this holds whatever mix of plays and passes got the seat here. Both the split
// point of a row AND the count that opens the challenge (`challengeOpen`).
// Mirrors Demo.jsx.
const CHALLENGE_FROM = 4

// "FINAL" because Kanteal also has a §7 `challenge` — a display-only marker on one
// card mid-cycle (Centre.jsx). Module-level so the identity is stable; PhaseBanner
// keys on `id`. Mirrors Demo.jsx.
const CHALLENGE_EVENT = {
  id: 'final-challenge',
  icon: '⚔️',
  title: 'FINAL CHALLENGE',
  note: 'Commit your last two cards',
}

const cardLabel = (c) => (c ? `${c.rank}${SUIT_MARK[c.suit]}` : '')

// `peek` — DEBUG ONLY: every opponent's hand face-up and dimmed (services/config.js
// DEBUG_PEEK). It cannot reveal §3 passes: a hidden played card never carries an
// identity to the client at all, so there is nothing there to un-hide.
export default function KantealBoard({ channel, room, waitingText, waitingAction = null, peek = false }) {
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
    const res = autoMove(s, seat)
    if (res?.state) send(res.state, seat)
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
      const res = autoMove(s, turnSeat)
      if (res?.state) send(res.state, turnSeat, s.seats[turnSeat].playerId)
    }, 1400)
    return () => clearTimeout(t)
  }, [amBotDriver, turnKey, turnSeat]) // eslint-disable-line react-hooks/exhaustive-deps

  // Round 2 — my held card reveals automatically after a short beat (the up/down
  // choice was locked at commit, so there's nothing to decide). Turn-based, so every
  // client sees the reveals land one after another.
  const myRevealSeat = playing && !isSpectator ? mySeat : -1
  const revealRef = useRef(null)
  useEffect(() => {
    const s = latest.current
    if (!s || s.round !== 2 || myRevealSeat < 0 || s.currentPlayer !== myRevealSeat) return
    if (s.commits?.[myRevealSeat] == null || revealRef.current === s.turnKey) return
    revealRef.current = s.turnKey
    const t = setTimeout(() => {
      const cur = latest.current
      if (!cur || cur.round !== 2 || cur.currentPlayer !== myRevealSeat) return
      const res = applyReveal(cur, myRevealSeat)
      if (res.state) send(res.state, myRevealSeat)
    }, 800)
    return () => clearTimeout(t)
  }, [myRevealSeat, turnKey]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Match-end coin change per player, from the server's settlement (game:end).
  const deltaById = new Map((channel.settlements ?? []).map((x) => [x.playerId, x.delta]))

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
      bot: info?.isBot === true,
      coin: info?.coin,
      // §4 — Kanteal crowns exactly ONE winner (no 2nd/3rd), so the only end-of-match
      // badge is the winner's crown + halo + confetti. No `rank` for anyone else.
      winner: over && gs.winner === abs(r),
      // The +/− coins from settlement, shown on each seat at match end.
      coinDelta: over ? (deltaById.get(s.playerId) ?? null) : null,
    }
  })

  // A committed seat holds its face-down Round-2 card in `hands` until the reveal. Keep
  // it OUT of the local fan — both cards read as dropped at commit, and the held one is
  // drawn (hidden) in the challenge stack instead, then revealed there. Mirrors Demo.jsx.
  const myDownId = gs?.commits?.[mySeat]?.downId ?? null
  const myHand = showHands && !isSpectator ? (gs.hands[mySeat] ?? []).filter((c) => c.id !== myDownId) : []
  const sortedHand = sortCards(myHand)
  const isMyTurn = playing && !isSpectator && gs.currentPlayer === mySeat && !gs.eliminated[mySeat]
  const legal =
    playing && !isSpectator
      ? legalMoves(gs, mySeat)
      : { canPlay: [], canPass: false, mustOpen: false, mustCommit: false, mustReveal: false }
  const picked = sortedHand.find((c) => c.id === selected) ?? null
  const pickedBeats = picked ? (legal.mustOpen ? true : canBeat(picked, gs?.table)) : false
  const canPlayPicked = isMyTurn && picked && legal.canPlay.some((c) => c.id === picked.id)
  const canPassPicked = isMyTurn && picked && legal.canPass

  // TABLE-WIDE, not per-seat: the challenge opens when the LAST seat still in the game
  // lays its fourth card, and every row slides out together. `>=` not `>` — it opens
  // when seats are READY to commit, before anyone has. Cut/"teav" seats are excluded:
  // their leftovers get dumped into `played`, so counting them would open it early.
  // `gs?.` throughout — this runs on every render, including before the first deal
  // when there is no game state at all (the room is still waiting).
  const contenders = gs?.seats?.map((_, i) => i).filter((i) => !gs.eliminated?.[i]) ?? []
  const challengeOpen =
    showHands &&
    contenders.length > 0 &&
    contenders.every((i) => (gs?.played?.[i]?.length ?? 0) >= CHALLENGE_FROM)

  const isFinalist = (seat) => challengeOpen && !gs?.eliminated?.[seat]

  // Chosen which of its last two goes face-up — a fifth `played` entry. NOT
  // `commits[seat] != null`: the engine clears that on the reveal, and the stack must
  // survive it. Per-seat, unlike isFinalist: until a seat commits, nothing about its
  // last two cards is public, so it keeps its hand blob and draws no stack.
  const hasCommitted = (seat) => (gs?.played?.[seat]?.length ?? 0) > CHALLENGE_FROM

  // A round is settled the instant the table clears: the engine nulls `table` and makes
  // the cycle's winner the next `opener`. Their winning card flips yellow → green and
  // stays that way until they lead, which is the cue that the next card is theirs to
  // drop. Their LAST face-up play is that card — one card per turn, so nothing of
  // theirs can have landed on top of it since.
  const lastFaceUpId = (seat) => {
    const row = gs?.played?.[seat] ?? []
    for (let i = row.length - 1; i >= 0; i--) if (row[i].card) return row[i].card.id
    return null
  }
  const wonId = gs && gs.phase === 'playing' && !gs.table ? lastFaceUpId(gs.opener) : null

  // Every seat's played cards, kept in front of them for the whole game — Kanteal's
  // table has no central pile. Rotated into my-perspective slots like the seats, so
  // slot 0 (my own history) lands bottom-centre, right above my hand. A finalist keeps
  // only its first four plays here; its challenge pair moves to `challengeAreas`.
  const playAreas = Array.from({ length: n }, (_, r) => {
    if (!showHands) return null
    const seat = abs(r)
    return (
      <PlayArea
        key={r}
        played={isFinalist(seat) ? gs.played[seat].slice(0, CHALLENGE_FROM) : (gs.played?.[seat] ?? [])}
        currentId={gs.table?.id ?? null}
        wonId={wonId}
        label={r === 0 ? null : seatSource[seat].name}
        dense={n > 4}
      />
    )
  })

  // Opponents' hands. WHILE PLAYING they're face-down counts — §3/§6 keep every
  // discarded and dropped card hidden, so a count is all that may be shown. AT MATCH
  // END (`over`) every seat's REMAINING cards turn face-up beside their profile, the
  // standard reveal — those leftovers are the cards they never played, so nothing
  // that was meant to stay hidden (passes, teav drops) is exposed. A cut/teav seat
  // has an empty hand by then (its cards were dropped into `played`), so it reveals
  // nothing here, only its ✕ marker.
  const opponentHands = Array.from({ length: n }, (_, r) => {
    if (!showHands) return null
    if (r === 0 && !isSpectator) return null
    const seat = abs(r)
    // A committed seat is drawn as its challenge stack instead. Gated on the commit,
    // not on the challenge opening — otherwise a seat that hasn't chosen yet shows
    // neither blob nor stack and its cards vanish off the felt.
    if (!over && hasCommitted(seat)) return null
    const h = gs.hands[seat]
    if (!h || !h.length) return null
    if (peek && !over) {
      return (
        <span key={r} className="block opacity-45 saturate-50">
          <Hand cards={h} size="xs" spread={0} curve={0} spacing={16} maxWidth={130} />
        </span>
      )
    }
    return over ? (
      <Hand key={r} cards={h} size="xs" spread={0} curve={0} spacing={20} maxWidth={130} />
    ) : (
      <Hand key={r} cards={h.slice(0, 1)} faceDown count={h.length} size="lg" />
    )
  })

  // The final-challenge pair, pulled in toward the felt centre: the face-up Round-1
  // card on top, the held Round-2 card peeking behind it (flips face-up once revealed).
  // Indexed by my-perspective slot like `playAreas`. Mirrors Demo.jsx.
  const challengeAreas = Array.from({ length: n }, (_, r) => {
    const seat = abs(r)
    // Not committed → nothing public to draw (two blank backs for a decision that
    // hasn't happened, and on your own seat alongside the cards still in your hand).
    if (!isFinalist(seat) || !hasCommitted(seat)) return null
    const pair = gs.played[seat].slice(CHALLENGE_FROM)
    return <ChallengeStack key={r} up={pair[0]?.card ?? null} down={pair[1]?.card ?? null} size="sm" />
  })

  // Which seats are IN the challenge — moves each row out to the preview ring, whether
  // or not its stack is drawn yet.
  const challengeSeats = Array.from({ length: n }, (_, r) => isFinalist(abs(r)))

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

  // Final challenge — commit both last cards: the picked card face-up (Round 1), the
  // other held face-down (Round 2). Locked once sent.
  function doCommit() {
    if (!picked) return
    const down = sortedHand.find((c) => c.id !== picked.id)
    if (!down) return setMessage('Need two cards to commit')
    const res = applyCommit(gs, mySeat, { upId: picked.id, downId: down.id })
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
    // Final challenge — the two-card commit and the Round-2 reveal.
    if (legal.mustReveal) return 'Revealing your held card…'
    if (legal.mustCommit) {
      return picked
        ? `Commit ${cardLabel(picked)} face-up — your other card stays hidden`
        : 'Final two — tap your face-up card; the other is hidden for Round 2'
    }
    // Deliberately NOT "you won the cycle": the opener is usually the previous
    // cycle's winner, but it's the next seat clockwise when that winner ran out of
    // cards — and it's simply seat 0 on the first cycle of a match.
    if (legal.mustOpen) return 'Open the cycle — play any card'
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
        {/* The hint normally renders in the felt CENTRE (see Centre.jsx) — no fixed
            corner stays clear of the seat ring at 6–8 players, and Kanteal's centre
            is empty by design. It falls back to this corner pill only while a §7
            challenge owns the centre. (Comment lives OUT here: inside a `cond && (…)`
            it would be a second expression and the build fails.) */}
        {(message || hint) && gs.challenge && (
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
          playAreas={playAreas}
          challengeAreas={challengeAreas}
          challengeSeats={challengeSeats}
          hand={
            showHands && !isSpectator ? (
              <Hand
                cards={sortedHand}
                selected={selected ? [selected] : []}
                onSelect={over || gs.eliminated[mySeat] || legal.mustReveal ? undefined : pick}
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
            <Centre gs={gs} hint={message || hint} />
          ) : over ? (
            // Match end: the reveal fans every seat's leftovers face-up around the
            // table and the winner is crowned + haloed on their avatar (Table). The
            // felt centre carries only a slim result line + the next-game countdown —
            // deliberately NOT a popup or a standings box (Kanteal has one winner, so
            // there's no list to show), so the table stays fully readable.
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="rounded-full border border-[#FFD27A]/50 bg-black/60 px-4 py-1.5 font-display text-sm text-[#FFD27A] [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                {gs.winner != null ? `🏆 ${gs.seats[gs.winner].name} wins!` : 'Game over'}
              </span>
              {waitingText && (
                <span className="font-display text-xs text-white/85 [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
                  {waitingText}
                </span>
              )}
              {waitingAction}
            </div>
          ) : (
            // The host's "Start now" (waitingAction) stacks directly under the
            // waiting message, so the one pre-game control sits with the text it
            // acts on instead of floating alone at the bottom of the felt.
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="rounded-2xl border border-white/15 bg-black/55 px-4 py-2 font-display text-sm text-white/85 [--stroke-width:0]">
                {waitingText}
              </span>
              {waitingAction}
            </div>
          )}

          {/* A sibling of the centre content, not part of it: the §7 challenge / hint
              keeps showing underneath, and the layer is pointer-events-none.
              Suppressed once there's a winner — the deciding move can open the
              challenge and end the match at once (a §6 cut leaving one player), and
              the result should own the centre. Passing null also clears it mid-show. */}
          <PhaseBanner event={challengeOpen && !over ? CHALLENGE_EVENT : null} />
        </Table>

        {/* Controls. Round 2 has none (the held card auto-reveals). At the final two
            cards it's a single COMMIT (pick your face-up card first). Otherwise the
            usual PASS / PLAY, both acting on the SAME selected card. */}
        {isMyTurn && !over && !legal.mustReveal && (
          <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-2">
            {legal.mustCommit ? (
              <Button variant="green" size="md" sizeTall="lg" disabled={!picked} onClick={doCommit}>
                COMMIT
              </Button>
            ) : (
              <>
                {/* Pass disappears entirely when it isn't legal — opening a cycle (§3)
                    and the ≤2-card endgame (§5) — rather than sitting there greyed out.
                    CONDITIONALLY RENDERED, not `className="hidden"`: Button's root is
                    `inline-block`, and Tailwind emits `.inline-block` AFTER `.hidden`,
                    so the class was silently dropped and PASS stayed on screen while
                    the player was opening. Classic trap 1 — verified in the built CSS. */}
                {legal.canPass && (
                  <Button variant="red" size="md" sizeTall="lg" disabled={!canPassPicked} onClick={doPass}>
                    PASS
                  </Button>
                )}
                <Button variant="green" size="md" sizeTall="lg" disabled={!canPlayPicked} onClick={doPlay}>
                  PLAY
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
