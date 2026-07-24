import GameTable from '../GameTable/GameTable.jsx'
import Button from '../Button/Button.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// TablePage — the in-game screen: a full-bleed background, a slim top HUD (Leave,
// room name, stake) and the GameTable board centred beneath it.
//
// DELIBERATELY THIN. The game itself — deal, turns, tricks, bots, the whole
// engine — lives in GameTable (a block). This page adds only what a SCREEN owns
// that the board shouldn't: the backdrop, and the chrome for leaving the room and
// reading where you are. Keeping them apart means GameTable stays portable and
// testable on its own, and the page can be reskinned without touching the rules —
// the same board/page split RoomPage draws around RoomCard.
//
// Leaving is REPORTED, not decided here: onLeave fires and the page above opens a
// confirm modal (a hand mid-play is real stakes), same contract as Footer's menu.
//
// Background: a real <img> under everything (-z-10 + `isolate`, see HomePage for
// why). Defaults to a dark felt-room gradient — busy landing art fights the board,
// so the table wants a calm, dim backdrop. Pass `background` to override.

export default function TablePage({
  background,
  roomName = 'Table',
  stake, // the room's bet, shown in the HUD; omit to hide the coin pill
  onLeave,
  className = '',
}) {
  return (
    <div className={`relative isolate min-h-app w-full overflow-hidden ${className}`}>
      {/* Fallback backdrop behind the table — only shows if the felt art hasn't
          painted yet, since the full-bleed table covers it. */}
      {background ? (
        <img src={background} alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover" draggable={false} />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-[#15324f] to-[#0a1a2b]" />
      )}

      {/* The board IS the page: `fill` stretches the table edge-to-edge, `bare`
          drops the workbench chrome so the hint floats on the felt. Wrapped in an
          absolute layer (not passed a position class — GameTable's root is
          `relative`, so an `absolute` on it would be dropped, same trap as Card). */}
      <div className="absolute inset-0">
        <GameTable bare fill />
      </div>

      {/* Top HUD floats over the table. Leave in the top-LEFT corner and the room
          pill in the top-RIGHT — the top-CENTRE is where the far opponent's seat
          sits, so the corners are the clear spots. z-40 keeps it above the board. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 px-3 py-3">
        <span className="pointer-events-auto">
          <Button shape="circle" size="sm" variant="red" outline="navy" aria-label="Leave table" onClick={onLeave}>
            ✕
          </Button>
        </span>

        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-1 backdrop-blur-[2px]">
          <span className="max-w-40 truncate font-display text-sm text-white [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
            {roomName}
          </span>
          {stake != null && (
            <span className="font-display text-sm text-[#FFD27A] [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
              <CoinIcon /> {stake.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
