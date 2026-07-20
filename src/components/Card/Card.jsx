import { useState } from 'react'
// Co-located, so the folder still copies out whole. These are the `deco` cards
// pinned along the panel's side borders.
import card1 from './card1.webp'
import card2 from './card2.webp'
import card3 from './card3.webp'
import card4 from './card4.webp'
import card5 from './card5.webp'
import card6 from './card6.webp'
import card7 from './card7.webp'
import card8 from './card8.webp'

// Card surface — two skins:
//   'solid' – chunky blue gradient with beveled inset edges (the game panel).
//   'glass' – translucent frosted panel with a backdrop blur (overlay panels).
// (Solid shares the bevel recipe with Button, duplicated on purpose so each
// component folder stays self-contained and copy-out-able.)
//
// `deco` pins playing-card art along the panel's side borders, half on / half off
// — a flourish for a headline moment (creating a room), not something every panel
// should wear, so it's opt-in. It lives HERE, not just in Modal, so any Card can
// use it — a bare Card, a form's own Card, or a Modal forwarding `deco` through.
// It costs a stacking context (`isolate`) when on; a plain Card renders exactly as
// before. Art is co-located (card1-8.png), so the folder still copies out whole.
const SURFACE = {
  solid: [
    'border-[3px] border-[#00376B]',
    'bg-linear-to-b from-[#6CC3FF] via-[#2B7FC9] to-[#1E5FA0]',
    // inset edges: top/left highlight, bottom/right shadow
    'shadow-[inset_0_3px_0_rgba(255,255,255,0.55),inset_0_-3px_0_rgba(0,0,0,0.28),inset_3px_0_0_rgba(255,255,255,0.2),inset_-3px_0_0_rgba(0,0,0,0.2)]',
  ].join(' '),
  glass: [
    'border-2 border-white/45 bg-[rgba(120,185,235,0.32)] backdrop-blur-[2px]',
    'shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_10px_24px_rgba(0,0,0,0.25)]',
  ].join(' '),
}

// Corners live OUT of SURFACE and in a prop, for the same reason the layout does:
// a caller who needs different ones REPLACES this class instead of stacking a
// second radius on top of it. Two would collide, and Tailwind picks the winner by
// stylesheet order rather than by who asked last.
const RADIUS = { solid: 'rounded-[32px]', glass: 'rounded-[28px]' }

const DECK = [card1, card2, card3, card4, card5, card6, card7, card8]

// Where the six cards sit — all straddling a side border, half on the panel and
// half off. One high on each side, then a pair low on each side.
//
// The weighting is the design: a single card up top, two piled at each bottom
// corner. A heavy base grounds the panel and keeps the busy area away from a
// heading, while clearing the panel's middle where the content lives.
//
// STRADDLING: `left-0 -translate-x-1/2` puts the card's CENTRE on the edge, so the
// split stays 50/50 at any card size. Tailwind v4 compiles -translate-x-* to the
// standalone `translate` property, not `transform`, so it composes with the rotate
// below instead of overwriting it.
//
// VERTICAL STOPS ARE px, ANCHORED TO THE NEAREST CORNER — not percentages. A
// panel's height is whatever its content comes to, so a % stop lands differently
// in every one; anchoring the low pairs to `bottom-*` keeps a pile a pile whatever
// the height. The floors/ceilings keep each card inside the STRAIGHT run of the
// border: Card is rounded-[32px], so past ~32px from a corner the edge curves
// inward and a card pinned to `left-0` there would float off it.
//
// Angles are a nudge on top of the tilt in the PNG; the two cards in a pile lean
// opposite ways so they read as dropped rather than aligned.
const DECO_SLOTS = [
  // One high on each side — different heights, so the pair doesn't read as a rung.
  { pos: 'top-10 left-0 -translate-x-1/2', rot: -13 },
  { pos: 'top-14 right-0 translate-x-1/2', rot: 11 },
  // Two piled low on each side. ~12px of overlap within a pile.
  { pos: 'bottom-8 left-0 -translate-x-1/2', rot: -7 },
  { pos: 'bottom-20 left-0 -translate-x-1/2', rot: 9 },
  { pos: 'bottom-10 right-0 translate-x-1/2', rot: 13 },
  { pos: 'bottom-22 right-0 translate-x-1/2', rot: -10 },
]

/** Six of the eight, no repeats — a duplicate card is a wrong note in a card game.
 *  Partial Fisher-Yates: shuffles just the n it needs, not all eight. */
function deal(n) {
  const deck = [...DECK]
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (deck.length - i))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck.slice(0, n)
}

/**
 * Card — a game panel surface.
 *
 * @param variant  'solid' | 'glass'  (default 'solid')
 * @param radius   corner class, REPLACING the skin's default. A panel docked to
 *                 a screen edge wants its outer corners square:
 *                 radius="rounded-[32px_32px_0_0]" (see Footer).
 * @param deco     pin playing-card art along the side borders (default false).
 *
 * `className` holds the layout (size / padding / flow) and defaults to a nice
 * standalone look — passing your own REPLACES those defaults (so there's no
 * Tailwind override conflict). The surface (border/fill/shadow) always applies.
 * Extra props spread onto the root <div>.
 */
export default function Card({
  children,
  variant = 'solid',
  radius,
  deco = false,
  className = 'min-h-25 w-72 items-center justify-center p-6',
  ...props
}) {
  const v = SURFACE[variant] ? variant : 'solid'
  // A fresh hand per mount — the initializer runs once, so it can't re-deal (and
  // riffle the art) on a re-render. A caller that remounts the Card to re-open it
  // (Modal returns null while closed) gets a new hand each time for free.
  const [hand] = useState(() => deal(DECO_SLOTS.length))

  return (
    // `isolate` only when decorated: the deco layer sits at `-z-10` so a card
    // covers the border it straddles yet stays UNDER the content, and that
    // negative-z step only exists inside a stacking context. Card is otherwise
    // z-auto and makes none, so without this the layer escapes to the nearest
    // ancestor context and hides behind Card's opaque gradient. A plain Card skips
    // it — a stacking context isn't free (it traps any z-index inside).
    <div className={`relative flex ${SURFACE[v]} ${radius ?? RADIUS[v]} ${deco ? 'isolate' : ''} ${className}`} {...props}>
      {/* Card art along the side borders, half on / half off. Decorative, hence
          aria-hidden + pointer-events-none. NO overflow-hidden: the outer half has
          to escape the panel. -z-10 drops it below in-flow content but above the
          panel's own background + border (see the isolate note above). */}
      {deco && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {hand.map((src, i) => (
            <img
              key={DECO_SLOTS[i].pos}
              src={src}
              alt=""
              style={{ '--rot': `${DECO_SLOTS[i].rot}deg` }}
              className={`absolute w-14 max-w-none drop-shadow-[0_3px_4px_rgba(0,0,0,0.45)] transform-[rotate(var(--rot))] ${DECO_SLOTS[i].pos}`}
            />
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
