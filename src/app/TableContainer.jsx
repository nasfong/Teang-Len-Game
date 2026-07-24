import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button/Button.jsx'
import CoinIcon from '../components/CoinIcon/CoinIcon.jsx'
import FriendsModal from './FriendsModal.jsx'
import { useGame } from '../games/useGame.js'
import { DEFAULT_GAME_ID } from '../games/index.js'
import { useRoom } from '../query/rooms'
import { useRoomChannel } from '../net/useRoomChannel'

// TableContainer — the /table/:roomId screen. The table board is ALWAYS on screen:
// you land here, the seats fill, a 60s countdown auto-starts once there are 2+
// players (the host fires it), and the cards appear in place — lobby and gameplay
// are the same screen. The host can also skip the wait with "Start now".
//
// Kept short: this is both the "Starting in N…" copy and the setTimeout delay
// (× 1000 below), so anything large would effectively disable auto-start and leave
// dealing entirely dependent on the host tapping Start.
const AUTO_START_SECONDS = 1200

export default function TableContainer() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const { data: initialRoom, isError } = useRoom(roomId)
  const channel = useRoomChannel(roomId)
  const room = channel.room ?? initialRoom
  const queryClient = useQueryClient()

  // Which card game this room is playing. The module arrives in its own chunk, so
  // it's null for the first beat — see the loading branch below. Rooms created
  // before gameId existed have none, and fall back to the original game.
  const game = useGame(room?.gameId ?? DEFAULT_GAME_ID)

  useEffect(() => {
    if (isError) navigate('/room', { replace: true })
  }, [isError, navigate])

  // A finished game settled wallets server-side — refresh so the balance is current.
  useEffect(() => {
    if (channel.rankings) queryClient.invalidateQueries({ queryKey: ['wallet'] })
  }, [channel.rankings, queryClient])

  const chLeave = channel.leave
  function goToLobby() {
    chLeave() // detach from the room's socket channel
    navigate('/room', { replace: true })
  }

  // Mid-match leave is a TOGGLE: we never yank a player out of a live hand. If it's
  // armed when the match ends, ONLY this player leaves to the lobby; everyone else
  // stays for the next game.
  const [leaveArmed, setLeaveArmed] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const status = room?.status
  const playerCount = room?.players?.length ?? 0
  const hostId = room?.hostPlayerId
  const waiting = status === 'waiting' || status === 'starting'
  const enough = playerCount >= 2
  // A spectator holds no seat (a full room). Used to hide the Invite button — you
  // must hold a seat to invite.
  const isSpectator = Boolean(room && channel.playerId && !room.players?.some((p) => p.playerId === channel.playerId))
  // Am I actually IN the hand being played right now? Only then does Leave wait for
  // the match to end. Anyone just watching — a spectator, or someone who took a seat
  // mid-hand and is sitting this one out — leaves immediately, no condition. The live
  // match's seats come from the relayed game state.
  const liveSeats = (channel.game?.gameState ?? room?.gameState)?.seats
  const inCurrentMatch =
    status === 'playing' && Boolean(liveSeats?.some((s) => s.playerId === channel.playerId))

  // The server holds the real "leaving after this match" marker (room
  // .pendingLeavePlayerIds), so it survives a refresh and everyone can see it; the
  // local flag just keeps the button responsive before the snapshot echoes back.
  const queuedOnServer = Boolean(room?.pendingLeavePlayerIds?.includes(channel.playerId))
  const leaving = leaveArmed || queuedOnServer

  function onLeaveClick() {
    // Only a player in the live hand arms the leave toggle; everyone else leaves now.
    if (!inCurrentMatch) return goToLobby()
    const next = !leaving
    setLeaveArmed(next)
    if (next) channel.queueLeave()
    else channel.cancelQueueLeave()
  }

  // This player armed leave and the match just ended → leave now (others rematch).
  useEffect(() => {
    if (channel.rankings && leaving) {
      chLeave()
      navigate('/room', { replace: true })
    }
  }, [channel.rankings, leaving, chLeave, navigate])

  // Who won the last match here. Held in a ref (not state) because only the deal
  // reads it — re-rendering on it would just restart the countdown. It survives
  // across matches, so `channel.rankings` being cleared by the next game:update
  // can't lose it.
  const lastWinnerRef = useRef(null)
  useEffect(() => {
    const winner = channel.rankings?.find((r) => r.rank === 1)?.playerId
    if (winner) lastWinnerRef.current = winner
  }, [channel.rankings])

  // Auto-start: while waiting with 2+ players, run a 5s countdown; the host fires
  // game:start at 0. A join/leave (playerCount change) restarts it — and it also
  // fires the next game after a match (a rematch) for whoever stayed.
  const [countdown, setCountdown] = useState(null)
  const start = channel.start
  const playerId = channel.playerId
  const isHost = hostId === playerId

  // Deal the next game. Only the host may fire it (the server accepts game:start
  // from the host alone); everyone else's copy of this is a no-op. Shared by the
  // auto-start timer below and the "Start now" button, so both take the exact same
  // path — the winner-starts rule included.
  const fireStart = useCallback(() => {
    if (!isHost || !room || !game) return
    const seats = [...room.players]
      .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
      .map((p) => ({ playerId: p.playerId, name: p.name }))
    // The server owns the rule (room.rules.winnerStartsNextGame); the host just
    // applies it. No previous winner (the room's first match) → 3♠ opens.
    const startingPlayerId = room.rules?.winnerStartsNextGame ? lastWinnerRef.current : null
    start(game.createMatch(seats, { startingPlayerId }), game.meta.turnSeconds)
  }, [isHost, room, game, start])

  useEffect(() => {
    if (!waiting || !enough || !room || !game) {
      setCountdown(null)
      return
    }
    setCountdown(AUTO_START_SECONDS)
    const tick = setInterval(() => setCountdown((c) => (c != null && c > 0 ? c - 1 : 0)), 1000)
    const fire = setTimeout(fireStart, AUTO_START_SECONDS * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(fire)
    }
    // playerCount so a new join (or a post-match rematch) restarts the countdown.
  }, [waiting, enough, status, playerCount, fireStart, room, game])

  // `game` shares the room's loading state: its chunk is fetched the moment the room
  // arrives, and the board can't render without it anyway.
  if (!room || !game) {
    return (
      <div className="flex min-h-app items-center justify-center bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
        <span className="font-display text-lg text-white/80 [--stroke-width:0]">Loading table…</span>
      </div>
    )
  }

  // Centre message while the deal is pending (results reveal → next countdown).
  // After a match the board itself lists the full standings next to the revealed
  // hands, so this is only the countdown — naming the winner here too would say it
  // twice.
  const justFinished = Boolean(channel.rankings?.length)
  const waitingText =
    status === 'playing'
      ? null
      : justFinished
        ? `Next game in ${countdown ?? '…'}…`
        : enough
          ? `Starting in ${countdown ?? AUTO_START_SECONDS}…`
          : 'Waiting for another player…'

  return (
    <div className="relative isolate min-h-app w-full overflow-hidden bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
      {/* HUD floats over the table. Pre-game the green Leave button leaves at once;
          mid-match it's a toggle — armed, only THIS player leaves when the match
          ends (tap again to cancel). */}
      <div className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={leaving ? 'red' : 'green'} outline="navy" onClick={onLeaveClick}>
            {leaving ? 'Leave ✓' : 'Leave'}
          </Button>
          {/* Invite friends — any time (they join an open seat for the next hand, or
              spectate if full). Spectators can't invite (they hold no seat). */}
          {!isSpectator && (
            <Button size="sm" variant="blue" outline="navy" onClick={() => setInviteOpen(true)}>
              Invite
            </Button>
          )}
        </div>
        {leaving && status === 'playing' && (
          <span className="rounded-full bg-black/55 px-2 py-0.5 font-display text-[11px] text-white/85 [--stroke-width:0]">
            Leaves when the match ends — tap to cancel
          </span>
        )}
      </div>
      <div className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center gap-2">
        {/* Live spectator count — shown only when someone's actually watching. */}
        {room.spectatorCount > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3 py-1 font-display text-sm text-white/90 [--stroke-width:0]">
            <span aria-hidden>👁</span> {room.spectatorCount}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-1">
          <span className="max-w-40 truncate font-display text-sm text-white [--stroke-width:0]">{room.gameId}</span>
          {room.betCoin > 0 && (
            <span className="font-display text-sm text-[#FFD27A] [--stroke-width:0]">
              Bet: <CoinIcon /> {room.betCoin.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* The board fills the screen. absolute inset-0 gives it a real height (a plain
          min-h-app parent leaves size-full children at 0 — that was the blank page). */}
      <div className="absolute inset-0">
        {/* The room's game owns the whole in-room screen — seats, felt and play —
            so a game needing a discard pile or a betting strip just draws one. */}
        {/* Start now — the host skips the auto-start countdown and deals at once
            (first game or a rematch, both while the room is waiting with 2+ players).
            Host only, since only the host can fire game:start. The Board hangs it
            under the waiting message (waitingAction), where the felt centre owns the
            layout — passing null the rest of the time. */}
        <game.Board
          channel={channel}
          room={room}
          waitingText={waitingText}
          waitingAction={
            waiting && enough && isHost ? (
              <Button size="sm" variant="green" outline="navy" onClick={fireStart}>
                Start
              </Button>
            ) : null
          }
        />
      </div>

      {/* Friends popup (same full experience as Home) with per-friend Invite,
          opened from the HUD's Invite button. */}
      <FriendsModal open={inviteOpen} onClose={() => setInviteOpen(false)} roomId={roomId} />
    </div>
  )
}
