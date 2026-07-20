import { Fragment } from 'react'
import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
// Corner-tab art. Co-located (not in src/assets/icons/ like the menu items),
// because — unlike the menu, which is the page's — these two tabs are FIXTURES of
// the bar itself: the bar always has them, so they travel with the folder.
import loklakIcon from './loklak.webp'
import settingIcon from './setting.webp'

// Footer — the bottom menu bar: PLAY on the left, breaking out over the panel's
// top edge; the menu on the right. Composite (Card + Button), so copying it out
// brings both folders.
//
//   <Footer
//     onPlay={() => navigate('/rooms')}
//     items={[{ id: 'friend', icon: <img src={friendIcon} alt="" />, label: 'Friend',
//              onClick: () => setOpen('friend') }, …]}
//   />
//
// THE MENU IS THE APP'S, NOT THE BAR'S. Footer knows how to lay out a PLAY button
// and a row of items; it doesn't know your game has a shop. So `items` comes in
// from the page — with the icons, the labels, and what each one opens. That's why
// the art lives in src/assets/icons/ rather than this folder: it's the menu's, and
// the menu belongs to whoever mounts the bar.
//
// Each item is { id, icon, label, onClick? }. `icon` is any node — an <img>, an
// emoji, an <svg>. Give an item its own `onClick`, or handle everything centrally
// with `onSelect(id)`.
//
// PLACEMENT IS THE PARENT'S JOB. The original hard-coded `position:absolute;
// bottom:0`, which welds it to one kind of screen; this renders a full-width
// centred bar, so you choose:
//
//   <div className="relative h-screen">… <Footer className="absolute bottom-0" /></div>
//   <Footer className="sticky bottom-0" />
//
// The overhang, panel gradient, bevels and 100px height are the original's. Width
// is max-w-170 rather than the original's 64%: 64% of a desktop is an enormous
// bar and 64% of a phone is too narrow — a max-width caps one and lets the other
// go full-bleed.

// How far PLAY and the menu float above the panel's top edge. Shared by both, so
// they can't drift apart — the original hard-coded -10px on the button alone.
const LIFT = 'relative -top-3 tall:-top-4'

// Divider between menu items — carved into the panel rather than drawn on it:
// a dark groove with a white highlight down its right side is how a bevelled
// surface reads at an inside edge. Same two-tone recipe as the panel's own
// `inset ... rgba(255,255,255,...)` over `inset ... rgba(0,0,0,...)` bevels, so
// it looks moulded from the panel instead of stuck to it.
// Fixed height rather than self-stretch: stretching would tie the groove's length
// to the tallest item's content, so a longer label would quietly resize it.
const DIVIDER = 'relative top-5 h-9 w-px shrink-0 self-center bg-[#00376B]/45 shadow-[1px_0_0_rgba(255,255,255,0.22)] tall:top-8 tall:h-14'

/** One destination: icon over label. Deliberately flat — a row of chunky 3D
 *  buttons would compete with PLAY, and PLAY has to win.
 *
 *  The icon is sized by HEIGHT with a natural width, not fitted to a square box.
 *  The art has mixed aspect ratios (a wide card fan, a square roundel, a wide
 *  stall), so a square slot + object-contain letterboxes each one differently and
 *  they end up looking like three different sizes. One shared height is what
 *  actually makes them read as a set that fills the bar.
 *
 *  No `active` state: these OPEN things (a friend list, a shop) rather than being
 *  a nav marking where you are, so there's no "current" one to mark.
 *
 *  Press feedback is pure CSS `active:` — no state, and it fires on touch, same
 *  approach as Button. The two durations do the work: 75ms in so the pop is
 *  instant under the thumb, 200ms out so it settles rather than snapping. Without
 *  the fast-in, a quick tap releases before the scale has visibly moved and the
 *  press reads as unresponsive. The whole item scales, not just the icon, so the
 *  label comes with it and the target feels like one object.
 *  (`active:duration-75` is a class+pseudo-class, so it outranks `duration-200`
 *  by specificity — no stylesheet-order dependency.) */
function FooterItem({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-1 flex-col items-center justify-start gap-1 rounded-2xl px-1 pt-1 transition-transform duration-200 ease-out active:scale-110 active:duration-75"
    >
      <span className="flex h-[var(--menu-icon,80px)] items-center justify-center text-[34px] leading-none drop-shadow-[0_3px_3px_rgba(0,0,0,0.5)] tall:text-[52px] [&>img]:h-full [&>img]:w-auto [&>img]:object-contain">
        {icon}
      </span>
      <span className="font-display text-lg leading-none text-white/85 [--stroke-width:4px] tall:text-2xl tall:[--stroke-width:6px]">{label}</span>
    </button>
  )
}

/** A tab docked to a bottom corner of the bar — loklak on the left, settings on
 *  the right. It sits flush against the screen's side edge, so only its INNER
 *  corners round (border-radius is TL·TR·BR·BL): a left tab rounds its right side,
 *  a right tab its left. Same solid skin as the bar so they read as one unit.
 *  Press dips it (active:scale), the same touch feedback as the menu items. */
function CornerTab({ side, icon, alt, onClick }) {
  const radius = side === 'left' ? 'rounded-[0_24px_0px_0]' : 'rounded-[24px_0_0_0px]'
  return (
    // Position on THIS plain div, never on the Card. Card's root is hard-coded
    // `relative`, so an `absolute` passed through its className collides and loses
    // (stylesheet order → relative wins). That's why `bottom-0` did nothing and the
    // tab stayed at the top, and why `-bottom-12` was needed to shove it back down —
    // a magic offset tuned to the current heights, not responsive. With the wrapper
    // truly absolute, `bottom-0` genuinely hugs the bottom at any size.
    //
    // z-20 sits it ABOVE the bar (z-10). On desktop the bar is narrower than the
    // screen, so the tabs peek out past its sides and z never mattered — but on a
    // phone the bar is full-width and would bury them, so they must ride on top,
    // docked into the bar's free bottom corners (PLAY + menu lift over the TOP edge,
    // leaving the bottom corners clear).
    <div
      className={`absolute z-20 bottom-[env(safe-area-inset-bottom)] ${
        side === 'left' ? 'left-[env(safe-area-inset-left)]' : 'right-[env(safe-area-inset-right)]'
      }`}
    >
      {/* Half the bar's height (h-25 → h-12.5) — a shorter block tucked into the
          corner. Width sizes to the icon + padding. */}
      <Card radius={radius} className="h-9 items-center justify-center p-2 tall:h-12.5 tall:p-3">
        <button
          type="button"
          onClick={onClick}
          aria-label={alt}
          className="flex size-full items-center justify-center rounded-2xl transition-transform duration-200 ease-out active:scale-90 active:duration-75"
        >
          <img src={icon} alt="" className="h-6 w-auto object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.5)] tall:h-9" />
        </button>
      </Card>
    </div>
  )
}

/**
 * @param items     [{ id, icon, label, onClick? }] — the page's menu. Empty by
 *                  default: a bar with no menu is a PLAY button, which is a real
 *                  screen, whereas a bar with someone else's menu baked in is not.
 * @param onSelect  (id) => void. An item's own onClick wins if it has one.
 * @param onLoklak  tap handler for the left corner tab (loklak).
 * @param onSetting tap handler for the right corner tab (settings).
 */
export default function Footer({
  onPlay,
  playLabel = 'PLAY',
  playDisabled = false,
  items = [],
  onSelect,
  onLoklak,
  onSetting,
  className = '',
}) {
  return (
    // The CALLER positions this wrapper (e.g. className="absolute bottom-0"). It
    // must NOT carry its own `position`: a hard-coded `relative` here lands on the
    // same element as the caller's `absolute`, and Tailwind resolves that clash by
    // stylesheet order (relative wins) — which silently dropped the caller's
    // `absolute bottom-0` and left the whole bar stuck at the TOP of its container.
    <div className={`w-full ${className}`}>
      {/* Inner `relative` box is the anchor the corner tabs dock to — kept separate
          from the caller-positioned wrapper so the two positions can't collide.
          justify-center centres the bar; the tabs are absolute, so they ignore it. */}
      <div className="relative flex w-full justify-center">
        {/* Corner tabs, flush to the screen's sides. Behind the bar (no z), so PLAY
            and the menu, which lift over the panel, always read on top. */}
        <CornerTab side="left" icon={loklakIcon} alt="Loklak" onClick={onLoklak} />

        <Card
          // Docked to the screen's bottom edge, so only the top corners round. z-10
          // keeps the bar above the corner tabs where they'd otherwise overlap.
          radius="rounded-[32px_32px_0_0]"
          // items-start, not items-center: PLAY and the menu are different heights,
          // and centring each one independently would leave their tops on different
          // lines. Aligning tops is what makes them read as one floating row.
          // The space this leaves at the bottom is wanted — the bar sits on the
          // screen edge, where a phone's home indicator lives.
          className="z-10 h-20 w-full max-w-170 items-start gap-2 px-4 tall:h-25 tall:gap-4 tall:px-6"
        >
          {/* PLAY breaks out over the panel's top edge — the original's best idea.
            The wrapper takes the offset: Button's root is `relative` for its slab,
            so a position class passed to it would be silently dropped. */}
          <span className={`${LIFT} shrink-0`}>
            <Button size="lg" sizeTall="xl" outline='navy' onClick={onPlay} disabled={playDisabled}>
              {playLabel}
            </Button>
          </span>

          {/* flex-1 claims every pixel PLAY leaves; the items then split it evenly,
            so the menu grows into the free space instead of huddling at the edge.
            Same LIFT as PLAY, so both float off the panel by the same amount. */}
          {/* --menu-icon sizes each FooterItem's icon; compact on short screens. */}
          <div className={`relative -top-6 flex flex-1 items-stretch justify-around gap-1 [--menu-icon:48px] tall:-top-10 tall:[--menu-icon:80px]`}>
            {items.map((it, i) => (
              <Fragment key={it.id ?? it.label}>
                {/* Between items only — never a trailing groove against the panel's
                  own edge, which already has its bevel. */}
                {i > 0 && <span aria-hidden className={DIVIDER} />}
                <FooterItem icon={it.icon} label={it.label} onClick={it.onClick ?? (() => onSelect?.(it.id))} />
              </Fragment>
            ))}
          </div>
        </Card>
        <CornerTab side="right" icon={settingIcon} alt="Settings" onClick={onSetting} />
      </div>
    </div>
  )
}
