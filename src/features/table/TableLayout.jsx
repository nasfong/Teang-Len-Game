import CoinIcon from '../../components/CoinIcon/CoinIcon.jsx'
import { DEBUG_PEEK } from '../../services/config'

// TableLayout — the screen chrome both table screens share: felt-room backdrop, the
// two safe-area HUD corners, the room/bet pill, and the full-bleed board layer.
// Shared by TableScreen (online) and SoloTableScreen (bots), which used to hold
// identical copies of all of it.
//
// Not in components/ — it's app-specific (safe-area insets, the bet pill), not a
// portable leaf.

const ROOM_SCREEN = 'relative isolate min-h-app w-full overflow-hidden bg-linear-to-b from-[#15324f] to-[#0a1a2b]'
const HUD_LEFT = 'absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-40'
const HUD_RIGHT =
  'absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center gap-2'

export function TableLoading() {
  return (
    <div className="flex min-h-app items-center justify-center bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
      <span className="font-display text-lg text-white/80 [--stroke-width:0]">Loading table…</span>
    </div>
  )
}

/**
 * @param hudLeft   top-left corner nodes (Leave, Invite, status notes)
 * @param hudRight  nodes placed BEFORE the room pill (e.g. spectator count)
 * @param children  the game board
 */
export default function TableLayout({ hudLeft, hudRight, gameCode, betCoin = 0, children }) {
  return (
    <div className={ROOM_SCREEN}>
      {/* The corner wrappers own the positioning, so callers never pass a position
          class to a Button (Trap 1). */}
      <div className={`${HUD_LEFT} flex flex-col items-start gap-1`}>{hudLeft}</div>

      <div className={HUD_RIGHT}>
        {/* Impossible to miss, on purpose. A table where everyone can read everyone's
            hand must never be mistaken for a normal one — this is the only thing
            standing between a debug build and a silently unfair game. */}
        {DEBUG_PEEK && (
          <span className="rounded-full border border-[#ff7a7a] bg-[#7a1010] px-3 py-1 font-display text-xs tracking-wide text-white [--stroke-width:0]">
            👁 PEEK — ALL HANDS VISIBLE
          </span>
        )}
        {hudRight}
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-1">
          <span className="max-w-40 truncate font-display text-sm text-white [--stroke-width:0]">{gameCode}</span>
          {betCoin > 0 && (
            <span className="font-display text-sm text-[#FFD27A] [--stroke-width:0]">
              Bet: <CoinIcon /> {betCoin.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* absolute inset-0 is what gives the board a real height — a plain min-h-app
          parent leaves size-full children at 0. */}
      <div className="absolute inset-0">{children}</div>
    </div>
  )
}
