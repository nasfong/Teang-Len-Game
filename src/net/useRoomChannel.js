import { useCallback, useEffect, useReducer } from 'react'
import { connectSocket } from '../net/socket'
import { CLIENT_EVENTS, SERVER_EVENTS } from '../net/events'
import { useSession } from '../state/session'

// useRoomChannel — the live socket link for ONE room (the table screen).
//
// On mount it joins the room's socket channel (room:join) and keeps a mirror of
// the authoritative RoomSnapshot (room:update) plus the relayed opaque gameState
// (game:update) — the backend never reads gameState; our engine owns the rules.
// It exposes the client→server actions (ready / start / play / skip / leave) as the
// only place those events are emitted.
//
// State moves through a reducer because a socket burst (e.g. game:end carries both
// final state and rankings) touches several fields together.

const initialState = {
  room: null, // latest RoomSnapshot
  game: null, // { gameState, version, triggeredBy, turnStartedAt } from game:update
  rankings: null, // set on game:end — non-null means the match is over
  timeoutCount: 0, // bumps on each turn:timeout (the acting client decides what to do)
  error: null, // last server error message
}

function reducer(state, action) {
  switch (action.type) {
    case 'room':
      return { ...state, room: action.room }
    case 'game':
      // A fresh game:update supersedes any prior end (a new deal after results).
      return { ...state, game: action.game, rankings: null }
    case 'timeout':
      return { ...state, timeoutCount: state.timeoutCount + 1 }
    case 'end':
      return { ...state, rankings: action.rankings, game: state.game ? { ...state.game, gameState: action.gameState } : state.game }
    case 'error':
      return { ...state, error: action.message }
    case 'clearError':
      return { ...state, error: null }
    default:
      return state
  }
}

export function useRoomChannel(roomId) {
  const playerId = useSession((s) => s.user?.id)
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!roomId || !playerId) return
    const socket = connectSocket()

    const onRoom = ({ room }) => dispatch({ type: 'room', room })
    const onGame = (game) => dispatch({ type: 'game', game })
    const onTimeout = () => dispatch({ type: 'timeout' })
    const onEnd = ({ rankings, gameState }) => dispatch({ type: 'end', rankings, gameState })
    const onError = ({ message }) => dispatch({ type: 'error', message })

    socket.on(SERVER_EVENTS.ROOM_UPDATE, onRoom)
    socket.on(SERVER_EVENTS.GAME_UPDATE, onGame)
    socket.on(SERVER_EVENTS.TURN_TIMEOUT, onTimeout)
    socket.on(SERVER_EVENTS.GAME_END, onEnd)
    socket.on(SERVER_EVENTS.ERROR, onError)

    // Join now, and re-join after any reconnect (a fresh socket isn't in the room).
    const join = () => socket.emit(CLIENT_EVENTS.ROOM_JOIN, { roomId, playerId })
    join()
    socket.on('connect', join)

    return () => {
      socket.off(SERVER_EVENTS.ROOM_UPDATE, onRoom)
      socket.off(SERVER_EVENTS.GAME_UPDATE, onGame)
      socket.off(SERVER_EVENTS.TURN_TIMEOUT, onTimeout)
      socket.off(SERVER_EVENTS.GAME_END, onEnd)
      socket.off(SERVER_EVENTS.ERROR, onError)
      socket.off('connect', join)
    }
  }, [roomId, playerId])

  const emit = useCallback((event, payload) => connectSocket().emit(event, payload), [])

  const ready = useCallback(() => emit(CLIENT_EVENTS.PLAYER_READY, { roomId, playerId }), [emit, roomId, playerId])

  // Host only — the dealt opening state is computed by the caller (engine.deal).
  const start = useCallback(
    (initialGameState, secondsPerTurn) =>
      emit(CLIENT_EVENTS.GAME_START, { roomId, playerId, initialGameState, secondsPerTurn }),
    [emit, roomId, playerId],
  )

  // Emit a move for a SPECIFIC seat's player — normally me, but an OFFLINE player's
  // id when a connected client bots their turn (Model A trust: the server relays any
  // seat's move without checking who sent it). play/skip are the self shorthands.
  // flags = { playerFinished?, finishedRank?, gameOver?, rankings? } (see gamePlaySchema).
  const playAs = useCallback(
    (actingId, gameState, flags = {}) => emit(CLIENT_EVENTS.GAME_PLAY, { roomId, playerId: actingId, gameState, ...flags }),
    [emit, roomId],
  )
  const skipAs = useCallback(
    (actingId, gameState) => emit(CLIENT_EVENTS.GAME_SKIP, { roomId, playerId: actingId, gameState }),
    [emit, roomId],
  )
  const play = useCallback((gameState, flags = {}) => playAs(playerId, gameState, flags), [playAs, playerId])
  const skip = useCallback((gameState) => skipAs(playerId, gameState), [skipAs, playerId])

  const leave = useCallback(() => emit(CLIENT_EVENTS.ROOM_LEAVE, { roomId, playerId }), [emit, roomId, playerId])

  // "Leave after match" — you stay for the hand in progress and the SERVER removes
  // you at endGame. Told to the server (not just held locally) so every client sees
  // the marker in the room snapshot, and so it still happens if you drop first.
  const queueLeave = useCallback(
    () => emit(CLIENT_EVENTS.ROOM_QUEUE_LEAVE, { roomId, playerId }),
    [emit, roomId, playerId],
  )
  const cancelQueueLeave = useCallback(
    () => emit(CLIENT_EVENTS.ROOM_CANCEL_QUEUE_LEAVE, { roomId, playerId }),
    [emit, roomId, playerId],
  )

  const clearError = useCallback(() => dispatch({ type: 'clearError' }), [])

  return { playerId, ...state, ready, start, play, skip, playAs, skipAs, leave, queueLeave, cancelQueueLeave, clearError }
}
