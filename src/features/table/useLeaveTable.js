import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Leaving a live table — the rule is "never yank a player out of a hand".
//
// If you're IN the match being played, Leave is a TOGGLE: it arms a marker and you
// drop to the lobby when the match ends, while everyone else stays for the next
// game. Tap again to cancel. Anyone not in the current hand — a spectator, or
// someone who took a seat mid-hand and is sitting this one out — leaves at once.
//
// The SERVER holds the real marker (room.pendingLeavePlayerIds) so it survives a
// refresh and every client can see it; the local flag only keeps the button
// responsive until the snapshot echoes back.
export function useLeaveTable({ channel, room }) {
  const navigate = useNavigate()
  const [leaveArmed, setLeaveArmed] = useState(false)

  const chLeave = channel.leave
  const goToLobby = useCallback(() => {
    chLeave() // detach from the room's socket channel
    navigate('/room', { replace: true })
  }, [chLeave, navigate])

  // A spectator holds no seat (a full room). Also used to hide Invite — you must
  // hold a seat to invite.
  const isSpectator = Boolean(
    room && channel.playerId && !room.players?.some((p) => p.playerId === channel.playerId),
  )

  // Am I actually IN the hand being played right now? Only then does Leave wait for
  // the match to end. The live match's seats come from the relayed game state.
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

  // Armed, and the match just ended → leave now (the others rematch without us).
  useEffect(() => {
    if (channel.rankings && leaving) {
      chLeave()
      navigate('/room', { replace: true })
    }
  }, [channel.rankings, leaving, chLeave, navigate])

  return { leaving, isSpectator, toggleLeave, goToLobby }
}
