import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button/Button.jsx'
import FriendsModal from '../features/friends/FriendsModal.jsx'
import TableLayout, { TableLoading } from '../features/table/TableLayout.jsx'
import { useAutoStart, AUTO_START_SECONDS } from '../features/table/useAutoStart'
import { useLeaveTable } from '../features/table/useLeaveTable'
import { useRoomChannel } from '../features/table/useRoomChannel'
import { useGame } from '../games/useGame.js'
import { DEFAULT_GAME_CODE } from '../games/index.js'
import { useRoom } from '../api/useRooms'
import { queryKeys } from '../api/keys'

// TableScreen — the /table/:roomId route. The board is ALWAYS on screen: you land
// here, the seats fill, a countdown auto-starts once there are 2+ players (the host
// fires it), and the cards appear in place — lobby and gameplay are one screen. The
// host can also skip the wait with "Start".
//
// This file is now composition only. The three things it used to implement inline
// live next to each other in features/table/:
//   TableLayout    the screen chrome (shared with the offline bot table)
//   useAutoStart   the countdown + the host's deal
//   useLeaveTable  the "leave after this hand" toggle
export default function TableScreen() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: initialRoom, isError } = useRoom(roomId)
  const channel = useRoomChannel(roomId)
  const room = channel.room ?? initialRoom

  // Which card game this room is playing. The module arrives in its own chunk, so
  // it's null for the first beat — see the loading branch below. The `??` is what
  // stops a room with no gameCode from parking on "Loading table…" forever.
  const game = useGame(room?.gameCode ?? DEFAULT_GAME_CODE)

  const { countdown, startNow, isHost, waiting, hasEnoughPlayers } = useAutoStart({ channel, room, game })
  const { leaving, isSpectator, toggleLeave } = useLeaveTable({ channel, room })
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    if (isError) navigate('/room', { replace: true })
  }, [isError, navigate])

  // A finished game settled wallets server-side — refresh so the balance is current.
  useEffect(() => {
    if (channel.rankings) queryClient.invalidateQueries({ queryKey: queryKeys.wallet })
  }, [channel.rankings, queryClient])

  // `game` shares the room's loading state: its chunk is fetched the moment the room
  // arrives, and the board can't render without it anyway.
  if (!room || !game) return <TableLoading />

  // Centre message while the deal is pending (results reveal → next countdown).
  // After a match the board itself lists the full standings next to the revealed
  // hands, so this is only the countdown — naming the winner here too would say it
  // twice.
  const justFinished = Boolean(channel.rankings?.length)
  const waitingText =
    room.status === 'playing'
      ? null
      : justFinished
        ? `Next game in ${countdown ?? '…'}…`
        : hasEnoughPlayers
          ? `Starting in ${countdown ?? AUTO_START_SECONDS}…`
          : 'Waiting for another player…'

  const canStartNow = waiting && hasEnoughPlayers && isHost

  return (
    <TableLayout
      gameCode={room.gameCode}
      betCoin={room.betCoin}
      hudLeft={
        <>
          <div className="flex items-center gap-2">
            {/* Pre-game this leaves at once; mid-match it's a toggle — armed, only
                THIS player leaves when the match ends (tap again to cancel). */}
            <Button size="sm" variant={leaving ? 'red' : 'green'} outline="navy" onClick={toggleLeave}>
              {leaving ? 'Leave ✓' : 'Leave'}
            </Button>
            {/* Invite friends any time (they take an open seat next hand, or
                spectate if full). Spectators can't invite — they hold no seat. */}
            {!isSpectator && (
              <Button size="sm" variant="blue" outline="navy" onClick={() => setInviteOpen(true)}>
                Invite
              </Button>
            )}
          </div>
          {leaving && room.status === 'playing' && (
            <span className="rounded-full bg-black/55 px-2 py-0.5 font-display text-[11px] text-white/85 [--stroke-width:0]">
              Leaves when the match ends — tap to cancel
            </span>
          )}
        </>
      }
      hudRight={
        // Live spectator count — shown only when someone's actually watching.
        room.spectatorCount > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3 py-1 font-display text-sm text-white/90 [--stroke-width:0]">
            <span aria-hidden>👁</span> {room.spectatorCount}
          </div>
        )
      }
    >
      {/* The room's game owns the whole in-room screen — seats, felt and play — so a
          game needing a discard pile or a betting strip just draws one. The Board
          hangs `waitingAction` under the waiting message, where the felt centre owns
          the layout. */}
      <game.Board
        channel={channel}
        room={room}
        waitingText={waitingText}
        waitingAction={
          canStartNow ? (
            <Button size="sm" variant="green" outline="navy" onClick={startNow}>
              Start
            </Button>
          ) : null
        }
      />

      {/* Friends popup (same full experience as Home) with per-friend Invite. */}
      <FriendsModal open={inviteOpen} onClose={() => setInviteOpen(false)} roomId={roomId} />
    </TableLayout>
  )
}
