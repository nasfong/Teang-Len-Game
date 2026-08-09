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
  const [penalty, setPenalty] = useState(null)

  // Persist every state change so a reload resumes the hand.
  useEffect(() => {
    if (game) writeSolo({ roomId: config.roomId, config, game })
  }, [game, config])

  const commit = useCallback(
    (gs, flags) => {
      // Mid-hand penalties (Teang Len's chặt). Online the server prices these and
      // broadcasts game:penalty; offline nothing is at stake, so this only mirrors the
      // SHAPE, keeping the board's UI path identical. `amount: null` — pricing is the
      // game's business and this hook stays game-agnostic; the board fills it in.
      // Games whose state has no `lastPenalty` never trigger it.
      if (gs?.lastPenalty) {
        const { kind, fromSeat, toSeat } = gs.lastPenalty
        setPenalty((prev) => ({
          kind,
          fromPlayerId: gs.seats[fromSeat]?.playerId,
          toPlayerId: gs.seats[toSeat]?.playerId,
          amount: null,
          seq: (prev?.seq ?? 0) + 1,
        }))
      }
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
      // …and every non-human seat is a bot, so the Table badges it "Bot" not "AFK".
      isBot: s.playerId !== playerId,
      coin: s.playerId === playerId ? config.humanCoin : (s.coin ?? (config.betCoin ?? 0) * 20),
    }))
    return {
      roomId: config.roomId,
      name: config.name,
      gameCode: config.gameCode,
      betCoin: config.betCoin,
      maxPlayers: config.maxPlayers,
      // Back to 'waiting' once the match ends, exactly as the server does online. A
      // Board checks `playing` BEFORE `over`, so leaving this at 'playing' kept it in
      // the in-play branch at match end and its `waitingAction` slot — the New Game
      // button — was never rendered. Keyed on `rankings` rather than the game's own
      // phase so it stays game-agnostic.
      status: game && !rankings ? 'playing' : 'waiting',
      hostPlayerId: playerId,
      players,
      rules: { winnerStartsNextGame: false },
      gameState: game?.gameState ?? null,
      spectatorCount: 0,
      pendingLeavePlayerIds: [],
    }
  }, [config, game, playerId, rankings])

  return {
    playerId,
    room,
    game,
    rankings,
    settlements,
    penalty,
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
