import { useCallback, useEffect, useMemo, useState } from 'react'
import { writeSolo, clearSolo } from './soloGame.js'

// Winner-take-all, mirroring the server's Kanteal settlement: every non-winner seat
// loses the bet, the winner takes the whole pot. DISPLAY-ONLY here — a practice game
// never touches the real wallet, so this just feeds the +/− chips on the reveal.
function computeSettlements(gs, betCoin) {
  if (gs?.winner == null || !betCoin) return []
  const winnerId = gs.seats[gs.winner].playerId
  const losers = gs.seats.filter((s) => s.playerId !== winnerId)
  return gs.seats.map((s) =>
    s.playerId === winnerId
      ? { playerId: s.playerId, delta: losers.length * betCoin }
      : { playerId: s.playerId, delta: -betCoin },
  )
}

// A drop-in replacement for useRoomChannel that runs a game ENTIRELY client-side against
// bots — no socket, no server room, no other players. It exposes the exact contract the
// game Boards consume (playerId, room, game.gameState, start/play/playAs, settlements,
// rankings, leave), so NO game code changes.
//
// The trick: bots are modeled as OFFLINE seats and the human as the only ONLINE seat, so
// the Board's existing offline-bot driver (lowest online seat covers offline players)
// plays every bot automatically — exactly the Demo's auto-drop, but on the real board.
// The game state is persisted to localStorage on every move, so a refresh resumes the
// same hand.
export function useSoloChannel({ playerId, config, initialGame = null }) {
  const [game, setGame] = useState(initialGame) // { gameState, version, triggeredBy, turnStartedAt } | null
  const [rankings, setRankings] = useState(initialGame?.gameState?.phase === 'over' ? [] : null)
  const [settlements, setSettlements] = useState(null)

  // Persist every state change so a reload resumes the hand.
  useEffect(() => {
    if (game) writeSolo({ roomId: config.roomId, config, game })
  }, [game, config])

  const commit = useCallback(
    (gs, flags) => {
      setGame((prev) => ({
        gameState: gs,
        version: (prev?.version ?? 0) + 1,
        triggeredBy: playerId,
        turnStartedAt: Date.now(),
      }))
      if (flags?.gameOver) {
        setRankings(flags.rankings ?? [])
        setSettlements(computeSettlements(gs, config.betCoin ?? 0))
      }
    },
    [playerId, config.betCoin],
  )

  // Deal a fresh hand — clears the previous result first (a rematch).
  const start = useCallback(
    (gs) => {
      setRankings(null)
      setSettlements(null)
      commit(gs, {})
    },
    [commit],
  )

  const play = useCallback((gs, flags) => commit(gs, flags), [commit])
  const playAs = useCallback((_id, gs, flags) => commit(gs, flags), [commit])
  const leave = useCallback(() => clearSolo(), [])
  const noop = useCallback(() => {}, [])

  const room = useMemo(() => {
    const players = config.seats.map((s, i) => ({
      playerId: s.playerId,
      name: s.name,
      seatIndex: i,
      // The human is the only ONLINE seat; bots are offline, which is what makes the
      // Board drive them (see KantealBoard's bot driver).
      isOnline: s.playerId === playerId,
      coin: s.playerId === playerId ? config.humanCoin : (s.coin ?? (config.betCoin ?? 0) * 20),
    }))
    return {
      roomId: config.roomId,
      name: config.name,
      gameId: config.gameId,
      betCoin: config.betCoin,
      maxPlayers: config.maxPlayers,
      status: game ? 'playing' : 'waiting',
      hostPlayerId: playerId,
      players,
      rules: { winnerStartsNextGame: false },
      gameState: game?.gameState ?? null,
      spectatorCount: 0,
      pendingLeavePlayerIds: [],
    }
  }, [config, game, playerId])

  return {
    playerId,
    room,
    game,
    rankings,
    settlements,
    timeoutCount: 0, // no server turn timer offline — bots auto-play, the human plays at their pace
    error: null,
    start,
    play,
    playAs,
    skip: play,
    skipAs: playAs,
    ready: noop,
    leave,
    queueLeave: noop,
    cancelQueueLeave: noop,
    clearError: noop,
  }
}
