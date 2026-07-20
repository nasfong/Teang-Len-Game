import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button/Button.jsx'
import CoinIcon from '../components/CoinIcon/CoinIcon.jsx'
import FriendsModal from './FriendsModal.jsx'
import OnlineBoard from '../game/OnlineBoard.jsx'
import { createMatch } from '../game/match.js'
import { useRoom } from '../query/rooms'
import { useRoomChannel } from '../game/useRoomChannel'

// TableContainer — the /table/:roomId screen. The table board is ALWAYS on screen:
// you land here, the seats fill, a 5s countdown auto-starts once there are 2+
// players (the host fires it), and the cards appear in place — lobby and gameplay
// are the same screen. No ready/start buttons.
const AUTO_START_SECONDS = 5

export default function TableContainer() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const { data: initialRoom, isError } = useRoom(roomId)
  const channel = useRoomChannel(roomId)
  const room = channel.room ?? initialRoom
  const queryClient = useQueryClient()

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

  function onLeaveClick() {
    // Only a player in the live hand arms the leave toggle; everyone else leaves now.
    if (inCurrentMatch) setLeaveArmed((armed) => !armed)
    else goToLobby()
  }

  // This player armed leave and the match just ended → leave now (others rematch).
  useEffect(() => {
    if (channel.rankings && leaveArmed) {
      chLeave()
      navigate('/room', { replace: true })
    }
  }, [channel.rankings, leaveArmed, chLeave, navigate])

  // Auto-start: while waiting with 2+ players, run a 5s countdown; the host fires
  // game:start at 0. A join/leave (playerCount change) restarts it — and it also
  // fires the next game after a match (a rematch) for whoever stayed.
  const [countdown, setCountdown] = useState(null)
  const start = channel.start
  const playerId = channel.playerId

  useEffect(() => {
    if (!waiting || !enough || !room) {
      setCountdown(null)
      return
    }
    setCountdown(AUTO_START_SECONDS)
    const tick = setInterval(() => setCountdown((c) => (c != null && c > 0 ? c - 1 : 0)), 1000)
    const fire = setTimeout(() => {
      if (hostId === playerId) {
        const seats = [...room.players]
          .sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0))
          .map((p) => ({ playerId: p.playerId, name: p.name }))
        start(createMatch(seats), 15)
      }
    }, AUTO_START_SECONDS * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(fire)
    }
    // playerCount so a new join (or a post-match rematch) restarts the countdown.
  }, [waiting, enough, status, playerCount, hostId, playerId, start, room])

  if (!room) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
        <span className="font-display text-lg text-white/80 [--stroke-width:0]">Loading table…</span>
      </div>
    )
  }

  // Centre message while the deal is pending (winner recap → next countdown).
  const winnerName = channel.rankings?.length
    ? room.players.find((p) => p.playerId === channel.rankings.find((r) => r.rank === 1)?.playerId)?.name
    : null
  const waitingText =
    status === 'playing'
      ? null
      : winnerName
        ? `🏆 ${winnerName} won! Next game in ${countdown ?? '…'}…`
        : enough
          ? `Starting in ${countdown ?? AUTO_START_SECONDS}…`
          : 'Waiting for another player…'

  return (
    <div className="relative isolate min-h-dvh w-full overflow-hidden bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
      {/* HUD floats over the table. Pre-game the green Leave button leaves at once;
          mid-match it's a toggle — armed, only THIS player leaves when the match
          ends (tap again to cancel). */}
      <div className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={leaveArmed ? 'red' : 'green'} outline="navy" onClick={onLeaveClick}>
            {leaveArmed ? 'Leaving ✓' : 'Leave'}
          </Button>
          {/* Invite friends — any time (they join an open seat for the next hand, or
              spectate if full). Spectators can't invite (they hold no seat). */}
          {!isSpectator && (
            <Button size="sm" variant="blue" outline="navy" onClick={() => setInviteOpen(true)}>
              👥 Invite
            </Button>
          )}
        </div>
        {leaveArmed && status === 'playing' && (
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
          <span className="max-w-40 truncate font-display text-sm text-white [--stroke-width:0]">{room.name}</span>
          {room.betCoin > 0 && (
            <span className="font-display text-sm text-[#FFD27A] [--stroke-width:0]">
              Bet: <CoinIcon /> {room.betCoin.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* The board fills the screen. absolute inset-0 gives it a real height (a plain
          min-h-dvh parent leaves size-full children at 0 — that was the blank page). */}
      <div className="absolute inset-0">
        <OnlineBoard channel={channel} room={room} waitingText={waitingText} />
      </div>

      {/* Friends popup (same full experience as Home) with per-friend Invite,
          opened from the HUD's Invite button. */}
      <FriendsModal open={inviteOpen} onClose={() => setInviteOpen(false)} roomId={roomId} />
    </div>
  )
}
