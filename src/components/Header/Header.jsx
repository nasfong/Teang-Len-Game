import Avatar from '../Avatar/Avatar.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// Game dashboard header — logo tab, avatar, username/coin bars. Style + markup
// only: the original's auth store, router and font-injection are stripped out.
// Dynamic values come in as props (with defaults) so it renders standalone. Uses
// the font-display token (Lilita One) set up in index.css.
//
// The whole right-hand panel is the profile button — `onProfile` reports the tap
// and the PAGE opens whatever it wants (a Profile modal, a route), same contract
// as Footer's menu. Header importing Profile + Modal would drag five folders
// along and hard-code that a tap must open an overlay.
//
// Composite: uses Avatar, so copying Header out means bringing that folder too.
// EDGE color = #00376B, panel blue = #2B7FC9.

// Chunky outlined display text (title/subtitle) — outline via text-stroke.
const TITLE = 'font-display text-[20px] [--stroke-color:#00376B] tall:text-[32px]'

// Pill bar behind the username / coin balance. Narrower + shorter on compact.
const BAR =
  'flex h-6 w-[170px] items-center rounded-[20px_44px_44px_20px] bg-black/25 pl-9 tall:h-8 tall:w-[260px] tall:pl-12'
const BAR_TEXT = 'font-display text-sm leading-none tracking-[0.4px] [text-shadow:0_1px_4px_rgba(0,0,0,0.55)] tall:text-base'

// Right-hand angled panel — clip-path cuts the diagonal left edge; the stacked
// drop-shadows draw its blue-black border + soft ground shadow.
//
// The polygon is in raw px, so its bottom coords are tied to the panel height:
// change PANEL_H and the four bottom points move with it (the corner curve keeps
// its 2/6/11px offsets off the bottom edge). The SVG below hand-traces this same
// edge to draw the border — re-cut both together or the line peels off the edge.
// The panel shrinks 110px → 72px on a compact (phone-landscape) screen — smaller
// than it once was, to give the home content more of a short viewport. Its clip-path
// bottom coords are tied to that height, so each size gets its own polygon. The
// three sets (72 / 110) share the SAME proportions — the shape is scale-invariant —
// which is why the SVG border below, drawn once in a 110-tall viewBox and scaled to
// the panel via h-full, traces whichever height is active without a second path.
const PANEL = [
  'relative flex h-[72px] items-center gap-2.5 bg-[#2B7FC9] pr-[max(1.25rem,env(safe-area-inset-right))] pl-5 tall:h-[110px] tall:gap-4 tall:pr-[max(1.75rem,env(safe-area-inset-right))] tall:pl-8',
  'border-b-[3px] border-black shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]',
  '[clip-path:polygon(24px_72px,19px_70px,16px_68px,15px_65px,0_0,100%_0,100%_72px)]',
  'tall:[clip-path:polygon(36px_110px,29px_108px,24px_104px,22px_99px,0_0,100%_0,100%_110px)]',
  '[filter:drop-shadow(-3px_0_0_#00376B)_drop-shadow(0_4px_0_#00376B)_drop-shadow(0_7px_6px_rgba(0,0,0,0.35))]',
].join(' ')

// Press feedback for the panel — a dim wash rather than `active:brightness-*`,
// which would be a second `filter` on an element that already has one (they'd
// collide, and Tailwind picks by stylesheet order, not by who asked last). The
// overlay inherits the panel's clip-path, so it follows the angled edge exactly.
// Fast in / slow out, per the touch rule in AGENTS.md.
const PANEL_PRESS = [
  'text-left after:pointer-events-none after:absolute after:inset-0 after:bg-black/20',
  'after:opacity-0 after:transition-opacity after:duration-200',
  'active:after:opacity-100 active:after:duration-75',
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#FFD27A]',
].join(' ')

export default function Header({
  title = 'Teang Len',
  subtitle = 'Game',
  username = 'Player',
  coin = 1250,
  avatarSrc,
  onProfile,
}) {
  // A panel you can't tap isn't a control and shouldn't be tab-stopped — same
  // call PlayingCard makes.
  const Panel = onProfile ? 'button' : 'div'

  return (
    <div className="h-20 w-full tall:h-30">
      {/* Main strip — 80% height, top-aligned. `items-stretch` lets the logo tab fill
          the strip, while the panel keeps its own height and hangs below it. The
          wrapper reserves a little extra so the panel's drop-shadow isn't clipped. */}
      {/* The bar fills edge-to-edge; the safe-area inset lives INSIDE the badge
          (left) and panel (right) instead of on this row — so both shapes still
          bleed to the screen edge on a landscape notch, and only their CONTENT is
          pushed clear of it. Padding on the row itself would inset the shapes and
          leave blue gaps on the sides (iPhone 12 landscape). */}
      <div className="flex h-4/5 items-stretch justify-between border-b-[3px] border-[#00376B] bg-[#2B7FC9] shadow-[inset_0_-3px_0_rgba(255,255,255,0.4)]">
        {/* Logo tab — left rounded badge. Its left padding carries the notch inset
            so the badge fill reaches the true edge while the wordmark clears it. */}
        <div className="relative z-[2] flex flex-col items-center justify-center rounded-[0_64px_64px_0] bg-black/10 pr-6 pl-[max(1.5rem,env(safe-area-inset-left))] tall:pr-10 tall:pl-[max(2.5rem,env(safe-area-inset-left))]">
          <h1 className={`${TITLE} text-white`}>{title}</h1>
          <p className={`${TITLE} text-[#FFD27A]`}>{subtitle}</p>
        </div>

        {/* Right side — avatar + stacked bars. The whole panel is the profile tap
            target: a thumb gets 110px of height instead of hunting for an icon. */}
        <Panel
          {...(onProfile ? { type: 'button', onClick: onProfile, 'aria-label': 'Open profile' } : {})}
          className={`${PANEL} ${onProfile ? PANEL_PRESS : ''}`}
        >
          {/* Left diagonal border — mirrors the clip-path edge above, so its
              points must match PANEL's polygon. The second path is the same line
              shifted +5px in x: the highlight running alongside the black edge. */}
          <svg
            aria-hidden
            width="48"
            height="110"
            viewBox="0 0 48 110"
            fill="none"
            // h-full makes the border scale with the panel height (88px compact →
            // 110px tall) while w-auto keeps its aspect, so the traced edge matches
            // whichever clip-path is active.
            className="pointer-events-none absolute top-0 left-0 h-full w-auto"
          >
            <path d="M 0 0 L 22 99 L 24 104 L 29 108 L 36 110" stroke="#000" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
            <path d="M 5 0 L 27 99 L 29 104 L 34 108 L 41 110" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </svg>

          {/* Avatar — overlaps the front of both stacked bars. Two sizes: md fits the
              72px compact panel, lg the 110px tall one. Only one renders per
              breakpoint (the other is display:none), so it can't add a stray gap. */}
          <Avatar name={username} src={avatarSrc} size="md" className="z-3 -mr-8 tall:hidden" />
          <Avatar name={username} src={avatarSrc} size="lg" className="z-3 -mr-11 hidden tall:block" />

          {/* Stacked bars — username + coin balance */}
          <div className="flex flex-col gap-1.5 tall:gap-2.5">
            <div className={BAR}>
              <span className={`${BAR_TEXT} text-white`}>{username}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className={BAR}>
                <span className={`${BAR_TEXT} text-[#FFD27A]`}><CoinIcon /> {coin.toLocaleString()}</span>
              </div>
            </div>
          </div>

        </Panel>
      </div>
    </div>
  )
}
