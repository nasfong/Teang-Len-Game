import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button/Button.jsx'
import TableLayout, { TableLoading } from '../features/table/TableLayout.jsx'
import { useSoloChannel } from '../features/table/useSoloChannel.js'
import { readSolo, clearSolo } from '../features/table/soloGame.js'
import { useGame } from '../games/useGame.js'
import { DEFAULT_GAME_ID } from '../games/index.js'
import { useSession, selectUser } from '../stores/session'

// SoloTableScreen — the /solo route: a client-only "play vs bots" game with NO
// server room and NO other players (the "Play with Bots" toggle in CreateRoomForm
// lands here instead of creating a real room). It reuses the real game Board
// UNCHANGED by handing it a LOCAL channel (useSoloChannel) in place of the socket
// one, and the real table chrome via the same TableLayout as the online table.
//
// The setup and the game state live in localStorage — written by the lobby on create
// and by the channel on every move — so a refresh resumes the same hand.
export default function SoloTableScreen() {
  const navigate = useNavigate()
  const user = useSession(selectUser)
  const playerId = user?.id

  // Read the solo setup once. No config → nothing to play, back to the lobby.
  const saved = useMemo(() => readSolo(), [])
  const config = saved?.config ?? null

  const game = useGame(config?.gameId ?? DEFAULT_GAME_ID)
  const channel = useSoloChannel({
    playerId,
    config: config ?? { roomId: 'solo', seats: [], betCoin: 0 },
    initialGame: saved?.game ?? null,
  })

  useEffect(() => {
    if (!config) navigate('/room', { replace: true })
  }, [config, navigate])

  // Deal the first hand once the game module is loaded — unless a saved hand
  // resumed. The ref guards StrictMode's double-invoke from dealing twice.
  const chStart = channel.start
  const chGame = channel.game
  const seats = config?.seats
  const dealtRef = useRef(false)
  useEffect(() => {
    if (!game || chGame || !seats?.length || dealtRef.current) return
    dealtRef.current = true
    chStart(game.createMatch(seats, {}))
  }, [game, chGame, seats, chStart])

  if (!config || !game) return <TableLoading />

  const room = channel.room
  const over = Boolean(channel.rankings)

  function leave() {
    clearSolo() // it's local, so there's nothing to settle
    navigate('/room', { replace: true })
  }

  function newGame() {
    if (!seats?.length) return
    chStart(game.createMatch(seats, {}))
  }

  return (
    <TableLayout
      gameId={room.gameId}
      betCoin={room.betCoin}
      hudLeft={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="green" outline="navy" onClick={leave}>
            Leave
          </Button>
          <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1 font-display text-[11px] text-white/85 [--stroke-width:0]">
            Solo vs Bots
          </span>
        </div>
      }
    >
      {/* Same board as the multiplayer table. At match end the Board hangs the New
          Game button under the winner line (waitingAction). */}
      <game.Board
        channel={channel}
        room={room}
        bots
        waitingText={over ? 'Play again?' : null}
        waitingAction={
          over ? (
            <Button size="sm" variant="green" outline="navy" onClick={newGame}>
              New Game
            </Button>
          ) : null
        }
      />
    </TableLayout>
  )
}
