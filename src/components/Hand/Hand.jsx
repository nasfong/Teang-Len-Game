import PlayingCard from '../PlayingCard/PlayingCard.jsx'

// Hand — the fan of cards a player holds. Composite (wraps PlayingCard), so
// copying it out brings that folder too.
//
// Controlled: `selected` and `disabledIds` come from the game, since only the
// game knows what can legally beat the current trick. Reports via onSelect(id).
// Same component draws an opponent's hand — pass faceDown.
//
// EACH CARD SITS IN A ROTATED WRAPPER rather than being rotated directly. The
// card owns translate-y for its lift and hover; the fan needs translate-y for
// the arc. On one element those collide and Tailwind picks by stylesheet order,
// not by who asked last — so the wrapper takes the arc and the card keeps
// the lift. (A happy side effect: the lift inherits the wrapper's rotation, so a
// card slides out along its own axis the way you'd pull it from a real fan.)
//
// NO Z-INDEX ANYWHERE, deliberately. Cards paint in DOM order, so each covers
// the one dealt before it and every top-left index stays readable — the resting
// fan is the whole story. Hover and selection say so by lifting (and the card's
// gold ring), not by re-stacking: a card that jumped the queue on hover made the
// fan twitch, and the raised card still reads fine with its neighbour lapping
// its edge. If you ever do add a z rule here, drive it from a CSS var — an
// inline zIndex outranks classes and would kill any hover variant silently.

// Widths are duplicated from PlayingCard's SIZES because the spacing has to be
// computed in JS — keep them in step if you retune the card.
const SIZES = {
  xs: { w: 32, step: 12 },
  sm: { w: 48, step: 20 },
  md: { w: 64, step: 26 },
  lg: { w: 80, step: 34 },
}

/**
 * @param cards       [{ rank, suit, id? }] — id defaults to `${rank}-${suit}`,
 *                    which is unique within one deck
 * @param selected    ids currently lifted
 * @param disabledIds ids that can't be played right now
 * @param spread      degrees of rotation per card away from centre (0 = flat row)
 * @param curve       how far the outer cards dip, in px per offset² (0 = flat row)
 * @param maxWidth    px the fan must fit inside — spacing tightens to obey it
 * @param spacing     px between adjacent cards (the step). Defaults to the size's
 *                    tight overlap; raise it for a more spread-out row. maxWidth
 *                    still wins if the result wouldn't fit.
 * @param count       card-count badge. `true` shows the number of cards rendered;
 *                    pass a NUMBER to show that instead — e.g. a collapsed
 *                    opponent hand drawn as a single back that still reads "13"
 * @param flipMs      length of each card's flip (passed through to PlayingCard)
 * @param flipStagger ms of extra delay per card, left→right — cascades a flip
 *                    across the hand (card i starts at i × stagger). 0 = all flip
 *                    together.
 */
export default function Hand({
  cards = [],
  selected = [],
  disabledIds = [],
  onSelect,
  faceDown = false,
  size = 'md',
  spread = 3,
  curve = 0.8,
  maxWidth = 420,
  spacing,
  count = false,
  flipMs,
  flipStagger = 0,
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md
  const n = cards.length
  if (n === 0) return null

  // Cards sit `step` apart. Start from the requested spacing (or the size's tight
  // default), then tighten until the row fits maxWidth — a 13-card Teang Len hand
  // at full spacing would run off a phone.
  const step = Math.min(spacing ?? s.step, (maxWidth - s.w) / Math.max(n - 1, 1))
  const centre = (n - 1) / 2
  const sel = new Set(selected)
  const dis = new Set(disabledIds)

  return (
    // pb clears the arc's dip, pt clears a selected card's lift — both escape
    // the row box, so without the padding they'd be cropped by any parent.
    // `relative` anchors the count badge.
    <div className={`relative flex items-end justify-center px-4 pt-6 pb-8 ${className}`}>
      {/* How many cards are held — centred over the card face (for a faceDown
          opponent, "how many they still have to shed"). The overlay spans the
          card region only: top-6/bottom-8 skip the pt/pb padding above, so the
          badge centres on the card, not on the padded box. */}
      {count && (
        <span className="pointer-events-none absolute inset-x-0 top-6 bottom-8 z-10 flex items-center justify-center">
          <span className="min-w-6 rounded-full border-2 border-[#00376B] bg-white/60 px-1.5 py-0.5 text-center font-display text-sm text-[#00376B] [--stroke-width:0]">
            {typeof count === 'number' ? count : n}
          </span>
        </span>
      )}
      {cards.map((card, i) => {
        const id = card.id ?? `${card.rank}-${card.suit}`
        const offset = i - centre
        const isSelected = sel.has(id)

        return (
          <span
            key={id}
            // The recipe stays a literal class; only the per-card numbers come in
            // as custom properties — same pattern as --depth on Button.
            // No z-index on hover (see the header): a hovered card scales in place at
            // the SAME stacking level as the rest, so the fan never re-stacks or
            // twitches. Its right-hand neighbour laps its edge — fine, the scale still
            // reads. Hover is purely the card's own group-hover:scale-[1.05].
            className="origin-bottom transition-transform duration-150 transform-[rotate(var(--rot))_translateY(var(--dy))]"
            style={{
              '--rot': `${offset * spread}deg`,
              '--dy': `${offset * offset * curve}px`,
              marginLeft: i === 0 ? 0 : `${step - s.w}px`,
            }}
          >
            <PlayingCard
              {...card}
              faceDown={faceDown}
              size={size}
              selected={isSelected}
              disabled={dis.has(id)}
              flipMs={flipMs}
              // Cascade: each card starts its flip a beat after the one to its
              // left. Only meaningful when flipStagger > 0 (the deal reveal).
              flipDelayMs={i * flipStagger}
              onClick={onSelect ? () => onSelect(id) : undefined}
            />
          </span>
        )
      })}
    </div>
  )
}
