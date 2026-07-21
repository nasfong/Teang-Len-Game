import { useRef } from 'react'
import PlayingCard from '../PlayingCard/PlayingCard.jsx'

// Hand — the fan of cards a player holds. Composite (wraps PlayingCard), so
// copying it out brings that folder too.
//
// Controlled: `selected` and `disabledIds` come from the game, since only the
// game knows what can legally beat the current trick. Same component draws an
// opponent's hand — pass faceDown.
//
// Reports via onSelect(id, meta):
//   meta.sweep  — picked by dragging across the fan rather than tapped. A sweep is
//                 an explicit, literal choice, so a caller that expands a tap into a
//                 whole combination must NOT expand a swept card: the finger already
//                 said exactly which cards it wanted.
//   meta.expand — sent on RELEASE of a plain tap, naming the card that was pressed.
//                 The card is already selected by then; this is the caller's cue to
//                 grow that single card into the combination it belongs to (see the
//                 two-phase note below).
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

// How far the finger may travel before a press stops being a tap and becomes a
// sweep. Without a threshold ANY drift onto a neighbour started a sweep, so an
// ordinary tap that rolled a few pixels across a 52px strip quietly selected two
// cards — the "it selects one I didn't mean to" bug. 12px is the usual drag slop:
// below a thumb's natural wobble, well under the distance of a deliberate slide.
const SWEEP_SLOP = 12

// Invisible target padding above and below the row. The card box alone is a thin
// strip on a landscape phone, and a thumb that lands in the felt just under the
// cards should still pick the card it's beneath — the column is unambiguous, only
// the vertical aim was off. Costs nothing visually; the row already reserves this
// space as padding for the arc and the selection lift.
const HIT_SLOP_Y = 28

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
  const sel = new Set(selected)
  const dis = new Set(disabledIds)

  // SELECTION IS DRIVEN ENTIRELY FROM THE CONTAINER'S POINTER EVENTS, not from the
  // cards' own click handlers. Two reasons, both about how a card game has to feel:
  //
  // 1. IT COMMITS ON PRESS-DOWN. A card lifts the instant the finger lands, not
  //    after it's released. `click` only fires after pointerup, so tapping used to
  //    do visibly nothing for the whole press — a hundred-odd milliseconds of dead
  //    air that reads as lag next to a native card game, where the pressed state is
  //    the acknowledgement. (Taps under ~24ms of feedback are perceived as instant;
  //    a press-release round trip is nowhere near that.)
  // 2. THE CARDS OVERLAP, so only the topmost under the finger may count — which is
  //    exactly what hit-testing a POINT gives us, and not what per-card handlers do.
  //
  // The card's own onClick survives for KEYBOARD activation only (see handleCardClick),
  // which is what keeps Enter/Space and screen readers working.
  //
  // SWIPE TO SELECT — press a card and slide across the fan; every card the finger
  // passes is picked. A five-card straight is one gesture instead of five precise
  // taps on overlapping strips, and a sweep needs no aim at all.
  const drag = useRef(null)
  const lastPointerAt = useRef(0)
  const root = useRef(null)

  // Topmost card under the point, with a vertical tolerance. elementFromPoint is the
  // fast path and already resolves overlap correctly; the fallback only runs when the
  // finger missed the row entirely, and walks the cards BACKWARDS because they paint
  // in DOM order — the last one whose column covers x is the one on top.
  function idAt(x, y) {
    const hit = document.elementFromPoint(x, y)?.closest('[data-card-id]')
    if (hit) return hit.dataset.cardId
    const nodes = root.current?.querySelectorAll('[data-card-id]') ?? []
    for (let i = nodes.length - 1; i >= 0; i--) {
      const r = nodes[i].getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top - HIT_SLOP_Y && y <= r.bottom + HIT_SLOP_Y)
        return nodes[i].dataset.cardId
    }
    return null
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const startId = idAt(e.clientX, e.clientY)
    if (!startId) return
    // A sweep runs in ONE DIRECTION, decided by the card it started on: press an
    // unselected card and the drag only adds, press a selected one and it only
    // removes. Toggling per card meant a finger that wobbled back over its own path
    // undid its own work — the same rule a drag across checkboxes follows.
    const mode = sel.has(startId) ? 'remove' : 'add'
    drag.current = { startId, x: e.clientX, y: e.clientY, touched: new Set([startId]), moved: false, mode }
    // Commit immediately — this is the press-down feedback. It's LITERAL (sweep:true)
    // because we don't yet know if this is a tap or the start of a drag, and pulling
    // a whole combination up under a finger that's about to sweep would be wrong.
    // A plain tap gets its combination on release instead (onPointerUp).
    onSelect(startId, { sweep: true })
  }

  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      // Still inside the slop circle: this is a tap that hasn't fully settled, not a
      // drag. Bail before hit-testing so a few pixels of thumb roll can't grab the
      // neighbour.
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < SWEEP_SLOP) return
      d.moved = true
      // Claim the pointer only NOW. Capturing on pointerdown would retarget the
      // follow-up `click` to this container, and while we no longer select from that
      // click, it's still what a keyboard/AT click path relies on staying intact.
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    const id = idAt(e.clientX, e.clientY)
    if (!id || d.touched.has(id)) return // each card is decided once per gesture
    d.touched.add(id)
    // Skip any card already in the state this sweep is driving toward, so the
    // direction lock can't accidentally invert it.
    if (sel.has(id) === (d.mode === 'add')) return
    onSelect(id, { sweep: true })
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    lastPointerAt.current = performance.now()
    // A tap that never became a sweep: now that the gesture is known to be a tap, let
    // the caller grow the pressed card into the combination it belongs to. The card is
    // already lifted from pointerdown, so this only ever ADDS its partners.
    if (d && !d.moved && d.mode === 'add') onSelect(d.startId, { expand: true })
  }

  // KEYBOARD ONLY. A click from Enter/Space carries detail 0; a pointer-driven click
  // carries 1+ and has already been handled on pointerdown. The timestamp guard is
  // the belt to that braces — if any browser ever reports 0 for a tap, the click still
  // can't double-toggle the card the finger just picked.
  function handleCardClick(id, e) {
    if (e.detail !== 0) return
    if (performance.now() - lastPointerAt.current < 700) return
    onSelect(id)
  }

  if (n === 0) return null

  // Cards sit `step` apart. Start from the requested spacing (or the size's tight
  // default), then tighten until the row fits maxWidth — a 13-card Teang Len hand
  // at full spacing would run off a phone.
  const step = Math.min(spacing ?? s.step, (maxWidth - s.w) / Math.max(n - 1, 1))
  const centre = (n - 1) / 2

  return (
    // pb clears the arc's dip, pt clears a selected card's lift — both escape
    // the row box, so without the padding they'd be cropped by any parent.
    // `relative` anchors the count badge.
    // touch-none while the hand is interactive: a horizontal sweep must reach us as
    // pointermove, not get eaten as a pan gesture. Nothing here scrolls, and the
    // viewport already disables zoom, so nothing is lost.
    <div
      ref={root}
      className={`relative flex items-end justify-center px-4 pt-6 pb-8 ${onSelect ? 'touch-none select-none' : ''} ${className}`}
      onPointerDown={onSelect ? onPointerDown : undefined}
      onPointerMove={onSelect ? onPointerMove : undefined}
      onPointerUp={onSelect ? onPointerUp : undefined}
      onPointerCancel={onSelect ? onPointerUp : undefined}
    >
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
            // What the sweep hit-tests against (see idAt above).
            data-card-id={id}
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
              onClick={onSelect ? (e) => handleCardClick(id, e) : undefined}
            />
          </span>
        )
      })}
    </div>
  )
}
