import { useCallback, useEffect, useRef, useState } from 'react'

// The room's auto-deal rule, lifted out of the table screen.
//
// While the room is waiting with 2+ players, run a countdown; at zero the HOST
// fires game:start. A join or leave restarts it, and it runs again after a match so
// whoever stayed gets a rematch. `startNow` is the same path, fired by the host's
// Start button — so the button and the timer can't diverge (the winner-starts rule
// included).
//
// Only the host actually emits: the server accepts game:start from the host alone,
// so every other client's copy of this is a no-op that just renders the countdown.
//
// PREVIOUSLY 1200 (twenty minutes), while the comments around it described a 60s
// countdown and warned that "anything large would effectively disable auto-start" —
// which is exactly what it did: dealing depended entirely on the host tapping Start.
// Restored to the documented 60s.
export const AUTO_START_SECONDS = 60

/**
 * @param channel  the room channel (useRoomChannel) — playerId, start, rankings
 * @param room     the live RoomSnapshot
 * @param game     the loaded game module (null until its chunk lands)
 * @returns { countdown, startNow, isHost, waiting, hasEnoughPlayers }
 */
export function useAutoStart({ channel, room, game, seconds = AUTO_START_SECONDS }) {
  const [countdown, setCountdown] = useState(null)

  const status = room?.status
  const playerCount = room?.players?.length ?? 0
  const isHost = room?.hostPlayerId === channel.playerId
  const waiting = status === 'waiting' || status === 'starting'
  const hasEnoughPlayers = playerCount >= 2

  // Who won the last match here. Held in a ref (not state) because only the deal
  // reads it — re-rendering on it would just restart the countdown. It survives
  // across matches, so `channel.rankings` being cleared by the next game:update
  // can't lose it.
  const lastWinnerRef = useRef(null)
  useEffect(() => {
    const winner = channel.rankings?.find((r) => r.rank === 1)?.playerId
    if (winner) lastWinnerRef.current = winner
  }, [channel.rankings])

  const start = channel.start
  const startNow = useCallback(() => {
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
    if (!waiting || !hasEnoughPlayers || !room || !game) {
      setCountdown(null)
      return
    }
    setCountdown(seconds)
    const tick = setInterval(() => setCountdown((c) => (c != null && c > 0 ? c - 1 : 0)), 1000)
    const fire = setTimeout(startNow, seconds * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(fire)
    }
    // playerCount so a new join (or a post-match rematch) restarts the countdown.
  }, [waiting, hasEnoughPlayers, status, playerCount, startNow, room, game, seconds])

  return { countdown, startNow, isHost, waiting, hasEnoughPlayers }
}
