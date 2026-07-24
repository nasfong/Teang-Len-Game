import Avatar from '../Avatar/Avatar.jsx'
import Button from '../Button/Button.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// TopBar — a FLAT, one-line app bar, the space-saving sibling of Header. Header is
// the landing-screen dashboard (a 98–120px angled panel with the wordmark and the
// stacked username/coin bars); this is a single ~48px row for the screens INSIDE
// the app, where every pixel it doesn't take is a pixel the content list gets.
//
// One row, left to right: an optional Back button, the page title (takes the slack
// and truncates), an optional `action` slot the page fills (e.g. Create Room), a
// coin balance, and the avatar as the profile tap. Everything but the title is
// optional, so the same bar serves a lobby, a settings screen, a friends list.
//
// Same contract as Header: it reports taps (`onBack`, `onProfile`) and the PAGE
// decides what they open — TopBar imports no Modal/router. Composite (Avatar +
// Button + CoinIcon), so copying it out brings those folders too. Uses font-display.
// EDGE #00376B, panel blue #2B7FC9 — the same palette as Header, so the two read as
// one family when a flow moves from the landing screen to a lobby.

// The coin readout — the same recessed groove Header's bars use, so the number
// reads as carved into the bar rather than floating on it.
const COIN_PILL = [
  'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/25 px-3 py-1',
  'font-display text-sm leading-none text-[#FFD27A]',
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)] [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]',
].join(' ')

export default function TopBar({
  title = 'Rooms',
  coin,
  username = 'Player',
  avatarSrc,
  onProfile,
  onBack,
  action, // right-aligned node the page supplies (e.g. a Create button); optional
  className = '',
}) {
  return (
    // The bar bleeds edge-to-edge; the safe-area insets live in its padding so the
    // fill still reaches a landscape notch while the CONTENT clears it. border +
    // inset highlight match Header's bottom edge exactly.
    <header
      className={`flex h-12 w-full shrink-0 items-center gap-2.5 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]  tall:h-14 tall:gap-3 ${className}`}
    >
      {onBack && (
        <Button shape="circle" size="sm" variant="blue" outline="navy" aria-label="Back" onClick={onBack}c>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      )}

      {/* Title takes the slack (min-w-0 + truncate) so the right cluster keeps its
          size and a long title clips instead of shoving the coins/avatar off-row. */}
      <h1 className="mr-auto min-w-0 truncate font-display text-xl text-white [--stroke-color:#00376B] [text-shadow:0_2px_3px_rgba(0,0,0,0.3)] tall:text-2xl">
        {title}
      </h1>

      {action}

      {coin != null && (
        <span className={COIN_PILL}>
          <CoinIcon /> {coin.toLocaleString()}
        </span>
      )}

      {/* Avatar is the profile tap — a plain button so it isn't tab-stopped when the
          page passes no handler (same call PlayingCard/Header make). */}
      {onProfile ? (
        <button
          type="button"
          onClick={onProfile}
          aria-label="Open profile"
          className="shrink-0 rounded-[14px] transition-transform duration-200 ease-out active:scale-90 active:duration-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD27A]"
        >
          <Avatar name={username} src={avatarSrc} size="sm" />
        </button>
      ) : (
        <Avatar name={username} src={avatarSrc} size="sm" />
      )}
    </header>
  )
}
