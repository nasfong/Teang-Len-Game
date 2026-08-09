import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Leaving a table — never yank a player out of a live hand. If you're IN the current
// match, Leave is a TOGGLE: it arms a marker and you drop to the lobby when the match
// ends. Anyone else (spectator, or seated mid-hand and sitting it out) leaves at once.
//
// The SERVER holds the real marker (room.pendingLeavePlayerIds) so it survives a
// refresh and every client sees it; the local flag just keeps the button responsive.
export function useLeaveTable({ channel, room }) {
  const navigate = useNavigate()
  const [leaveArmed, setLeaveArmed] = useState(false)

  const chLeave = channel.leave
  const goToLobby = useCallback(() => {
    chLeave() // detach from the room's socket channel
    navigate('/room', { replace: true })
  }, [chLeave, navigate])

  // No seat = spectator (a full room). Also hides Invite.
  const isSpectator = Boolean(
    room && channel.playerId && !room.players?.some((p) => p.playerId === channel.playerId),
  )

  const liveSeats = (channel.game?.gameState ?? room?.gameState)?.seats
  const inCurrentMatch =
    room?.status === 'playing' && Boolean(liveSeats?.some((s) => s.playerId === channel.playerId))

  const queuedOnServer = Boolean(room?.pendingLeavePlayerIds?.includes(channel.playerId))
  const leaving = leaveArmed || queuedOnServer

  const toggleLeave = useCallback(() => {
    if (!inCurrentMatch) return goToLobby()
    const next = !leaving
    setLeaveArmed(next)
    if (next) channel.queueLeave()
    else channel.cancelQueueLeave()
  }, [inCurrentMatch, leaving, goToLobby, channel])

  // Armed and the match just ended → leave now; the others rematch.
  useEffect(() => {
    if (channel.rankings && leaving) {
      chLeave()
      navigate('/room', { replace: true })
    }
  }, [channel.rankings, leaving, chLeave, navigate])

  return { leaving, isSpectator, toggleLeave, goToLobby }
}
