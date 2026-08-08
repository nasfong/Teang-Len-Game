import CoinIcon from '../../components/CoinIcon/CoinIcon.jsx'

// TableLayout — the screen chrome every table shares: the felt-room backdrop, the
// two safe-area HUD corners, the room/bet pill, and the full-bleed board layer.
//
// WHY IT EXISTS: the multiplayer table (TableScreen) and the offline bot table
// (SoloTableScreen) had byte-identical copies of all of this — the same root
// classes, the same "Loading table…" panel, the same corner offsets, the same pill.
// Two copies of screen chrome drift, and had already started to.
//
// NOT in src/components/: this is app-specific, not a portable leaf — it knows about
// safe-area insets and the game/bet pill's contents. The portable prototype of this
// idea is components/TablePage, which the workbench gallery still renders.
//
// SLOTS, NOT PROPS-FOR-EVERYTHING: `hudLeft` and `hudRight` take whatever nodes the
// screen wants in each corner. The corner WRAPPERS own the positioning, so a caller
// never passes a position class down (CLAUDE.md Trap 1 — Button's root is
// `relative`, and an `absolute` handed to it is silently dropped).
//
// The board goes in `children` and is wrapped in `absolute inset-0`, which is what
// gives it a real height: a plain min-h-app parent leaves size-full children at 0
// (that was the blank-table bug).

const ROOM_SCREEN = 'relative isolate min-h-app w-full overflow-hidden bg-linear-to-b from-[#15324f] to-[#0a1a2b]'
// Corner offsets: at least 0.75rem, more when the device's safe area demands it.
const HUD_LEFT = 'absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-40'
const HUD_RIGHT =
  'absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center gap-2'

/** The shared "still fetching the room / the game chunk" screen. */
export function TableLoading() {
  return (
    <div className="flex min-h-app items-center justify-center bg-linear-to-b from-[#15324f] to-[#0a1a2b]">
      <span className="font-display text-lg text-white/80 [--stroke-width:0]">Loading table…</span>
    </div>
  )
}

/**
 * @param hudLeft   nodes for the top-left corner (Leave, Invite, status notes)
 * @param hudRight  nodes placed BEFORE the room pill (e.g. the spectator count)
 * @param gameCode    shown in the room pill
 * @param betCoin   shown in the room pill when > 0
 * @param children  the game board — stretched edge-to-edge under the HUD
 */
export default function TableLayout({ hudLeft, hudRight, gameCode, betCoin = 0, children }) {
  return (
    <div className={ROOM_SCREEN}>
      <div className={`${HUD_LEFT} flex flex-col items-start gap-1`}>{hudLeft}</div>

      <div className={HUD_RIGHT}>
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

      <div className="absolute inset-0">{children}</div>
    </div>
  )
}
