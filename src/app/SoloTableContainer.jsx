import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button/Button.jsx'
import CoinIcon from '../components/CoinIcon/CoinIcon.jsx'
import { useGame } from '../games/useGame.js'
import { DEFAULT_GAME_ID } from '../games/index.js'
import { useSession, selectUser } from '../state/session'
import { readSolo, clearSolo } from '../net/soloGame.js'
import { useSoloChannel } from '../net/useSoloChannel.js'

// SoloTableContainer — the /solo screen: a client-only "play vs bots" game with NO
// server room and NO other players (the "Play with Bots" toggle in CreateRoomForm lands
// here instead of creating a real room). It reuses the real game Board UNCHANGED by
// handing it a LOCAL channel (useSoloChannel) in place of the socket one. The setup and
// the game state live in localStorage — written by the lobby on create and by the
// channel on every move — so a refresh resumes the same hand.
export default function SoloTableContainer() {
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

  // Deal the first hand once the game module is loaded — unless a saved hand resumed.
  // The ref guards StrictMode's double-invoke from dealing twice.
  const chStart = channel.start
  const chGame = channel.game
  const seats = config?.seats
  const dealtRef = useRef(false)
  useEffect(() => {
    if (!game || chGame || !seats?.length || dealtRef.current) return
    dealtRef.current = true
    chStart(game.createMatch(seats, {}))
  }, [game, chGame, seats, chStart])

  function goToLobby() {
    clearSolo()
    navigate('/room', { replace: true })
  }

  function newGame() {
    if (!game || !seats?.length) return
    chStart(game.createMatch(seats, {}))
  }

  if (!config || !game) {
    return (
      <div className="flex min-h-app items-center justify-center bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
        <span className="font-display text-lg text-white/80 [--stroke-width:0]">Loading table…</span>
      </div>
    )
  }

  const room = channel.room
  const over = Boolean(channel.rankings)

  return (
    <div className="relative isolate min-h-app w-full overflow-hidden bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
      {/* Leave abandons the practice game (it's local, so nothing to settle). */}
      <div className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center gap-2">
        <Button size="sm" variant="green" outline="navy" onClick={goToLobby}>
          Leave
        </Button>
        <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1 font-display text-[11px] text-white/85 [--stroke-width:0]">
          Solo vs Bots
        </span>
      </div>
      <div className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-1">
          <span className="max-w-40 truncate font-display text-sm text-white [--stroke-width:0]">{room.gameId}</span>
          {room.betCoin > 0 && (
            <span className="font-display text-sm text-[#FFD27A] [--stroke-width:0]">
              Bet: <CoinIcon /> {room.betCoin.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* The board fills the screen — same as the multiplayer table. At match end the
          Board hangs the New Game button under the winner line (waitingAction). */}
      <div className="absolute inset-0">
        <game.Board
          channel={channel}
          room={room}
          waitingText={over ? 'Play again?' : null}
          waitingAction={
            over ? (
              <Button size="sm" variant="green" outline="navy" onClick={newGame}>
                New Game
              </Button>
            ) : null
          }
        />
      </div>
    </div>
  )
}
