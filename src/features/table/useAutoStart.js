import { useCallback, useEffect, useRef, useState } from 'react'

// The room's auto-deal: while waiting with 2+ players, run a countdown and let the
// HOST fire game:start at zero. A join/leave restarts it, and it also deals the
// rematch. `startNow` is the same path for the host's Start button, so the two can't
// diverge. Only the host emits — the server accepts game:start from the host alone.
//
// Was 1200 while the surrounding comments described 60s, which effectively disabled
// auto-start; restored to the documented value.
export const AUTO_START_SECONDS = 60

export function useAutoStart({ channel, room, game, seconds = AUTO_START_SECONDS }) {
  const [countdown, setCountdown] = useState(null)

  const status = room?.status
  const playerCount = room?.players?.length ?? 0
  const isHost = room?.hostPlayerId === channel.playerId
  const waiting = status === 'waiting' || status === 'starting'
  const hasEnoughPlayers = playerCount >= 2

  // A ref, not state: only the deal reads it, and re-rendering would restart the
  // countdown. Survives across matches, so the next game:update can't lose it.
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
    // The server owns the rule; the host just applies it. No previous winner → 3♠ opens.
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
    // playerCount so a join (or a post-match rematch) restarts the countdown.
  }, [waiting, hasEnoughPlayers, status, playerCount, startNow, room, game, seconds])

  return { countdown, startNow, isHost, waiting, hasEnoughPlayers }
}
