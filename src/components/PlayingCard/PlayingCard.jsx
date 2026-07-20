// PlayingCard — one card from the deck: corner indices, centre pip, and a
// patterned back. Self-contained, Tailwind-only. Uses the font-display token.
//
// NOT to be confused with Card — that's the blue panel surface. This is the
// thing you actually play with.
//
// Stateless: `selected` and `disabled` come from the parent, because in a
// shedding game like Teang Len the hand decides what's liftable and what can't
// beat the current trick — a lone card can't know either.
//
// Both faces are ALWAYS in the DOM, stacked back-to-back on a preserve-3d layer.
// Flipping `faceDown` rotates that layer 180° on Y, so a card physically turns
// over — dealing a hand face-up, revealing an opponent's card, etc. A CSS
// transition only fires on a CHANGE, so a card that mounts in its final state
// just appears; it doesn't spin on load. Pure CSS, no animation library, so the
// component copies out clean.

const SUITS = {
  spades: { glyph: '♠', name: 'Spades', color: 'text-[#1B2733]' },
  clubs: { glyph: '♣', name: 'Clubs', color: 'text-[#1B2733]' },
  diamonds: { glyph: '♦', name: 'Diamonds', color: 'text-[#D42F2F]' },
  hearts: { glyph: '♥', name: 'Hearts', color: 'text-[#D42F2F]' },
}

// Real cards are 2.5×3.5in — every box below holds that 1:1.4 ratio, so a card
// never looks subtly wrong next to a real one.
const SIZES = {
  xs: { box: 'h-11 w-8', radius: 'rounded', index: 'text-[8px]', pip: 'text-lg', emblem: 'text-[10px]', lift: '-translate-y-2' }, // 32px — an opponent's face-down card
  sm: { box: 'h-17 w-12', radius: 'rounded-md', index: 'text-[11px]', pip: 'text-2xl', emblem: 'text-sm', lift: '-translate-y-2.5' },
  md: { box: 'h-22 w-16', radius: 'rounded-lg', index: 'text-sm', pip: 'text-4xl', emblem: 'text-lg', lift: '-translate-y-4' },
  lg: { box: 'h-28 w-20', radius: 'rounded-xl', index: 'text-base', pip: 'text-5xl', emblem: 'text-xl', lift: '-translate-y-5' },
}

// Lilita One is the game's voice, but the global outline would ink a navy edge
// around red/black pips on a white face — so this is a [--stroke-width:0] zone.
const FACE_TEXT = 'font-display leading-none [--stroke-width:0]'

// Shared by both faces: the card outline, white fill on the front is set at the
// call site. Kept as one string so the two sides can't drift out of step.
const FACE_BASE = 'absolute inset-0 border-[3px] border-[#1B2733] [backface-visibility:hidden]'

/** Corner index — rank stacked over its suit. Repeated upside-down bottom-right,
 *  the way a real card reads from either end. */
function Index({ rank, suit, size, corner }) {
  return (
    <span
      className={`absolute flex flex-col items-center ${FACE_TEXT} ${size.index} ${suit.color} ${
        corner === 'top' ? 'top-0.5 left-1' : 'right-1 bottom-0.5 rotate-180'
      }`}
    >
      <span>{rank}</span>
      <span className="-mt-px">{suit.glyph}</span>
    </span>
  )
}

function Back({ size }) {
  return (
    <>
      {/* Woven diagonal stripes — a flat fill would read as a blank tile */}
      <div
        className={`absolute inset-0 ${size.radius} bg-[#1E5FA0] bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.16)_0_4px,transparent_4px_8px)]`}
      />
      <div className="absolute inset-[3px] rounded-[4px] border-2 border-[#FFD27A]/55" />
      <span className={`absolute inset-0 flex items-center justify-center text-[#FFD27A]/85 ${size.emblem}`}>♠</span>
    </>
  )
}

/**
 * @param rank      '2'–'10' | 'J' | 'Q' | 'K' | 'A'
 * @param suit      'spades' | 'hearts' | 'diamonds' | 'clubs'
 * @param faceDown  show the back (opponents' hands, the draw pile). Toggling it
 *                  flips the card over with a 3D turn.
 * @param selected  lifted, ready to play
 * @param disabled  can't be played right now — dimmed and inert
 * @param size      'sm' | 'md' | 'lg'  (default 'md')
 * @param flipMs    length of the 3D flip (default 500)
 * @param flipDelayMs  delay before this card's flip starts — lets a hand cascade
 *                  the reveal, each card a beat after the last (default 0)
 * Renders a <button> when onClick is given, a <div> otherwise — a card you can't
 * play isn't a control and shouldn't be tab-stopped.
 */
export default function PlayingCard({
  rank = 'A',
  suit = 'spades',
  faceDown = false,
  selected = false,
  disabled = false,
  size = 'md',
  flipMs = 500,
  flipDelayMs = 0,
  onClick,
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md
  const su = SUITS[suit] ?? SUITS.spades
  const interactive = Boolean(onClick)
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      {...(interactive ? { type: 'button', onClick, disabled } : {})}
      aria-label={faceDown ? 'Face-down card' : `${rank} of ${su.name}`}
      // The button is ONLY the hit area + layout box — it deliberately never
      // moves. A still pointer target is what kills the hover flicker: when the
      // card itself lifted, it slid out from under the cursor, lost :hover, fell
      // back, and re-triggered — a jitter mouse users feel. All motion lives on the
      // inner lift layer and is driven by group-hover, so the target stays put.
      className={`group relative block shrink-0 ${s.box} ${s.radius} ${
        disabled ? 'opacity-45' : interactive ? 'cursor-pointer' : ''
      } focus:outline-none ${className}`}
    >
      {/* Lift layer — the part that MOVES. Hover pops it up a little and scales it
          a touch; selection raises it further and rings it gold; a press dips it.
          The shadow and ring live here so they travel with the lifted card.
          `perspective` sits here because it must wrap the flip layer it gives depth
          to. hover/selected drive `scale` + `translate` (separate CSS props in v4,
          so they compose), and the flip's rotateY is on the child below — three
          layers, zero transform collisions. */}
      <div
        className={`relative size-full ${s.radius} perspective-[700px] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
          // hover lift is skipped while selected so the two don't fight over the
          // raised position — a selected card just sits proud on its own.
          selected
            ? `${s.lift} scale-[1.04] shadow-[0_10px_16px_rgba(0,0,0,0.45)] ring-3 ring-[#FFD27A]`
            : 'shadow-[0_3px_7px_rgba(0,0,0,0.4)]'
        } ${interactive && !selected && !disabled ? 'group-hover:scale-[1.05]' : ''} ${
          interactive && !disabled ? 'group-active:scale-[0.97]' : ''
        } group-focus-visible:ring-3 group-focus-visible:ring-white`}
      >
        {/* The turning layer. preserve-3d keeps both faces in their own planes so
            the far one truly hides behind the near one; rotateY(180) is the flip.
            A card that never changes `faceDown` never triggers this transition. */}
        <div
          className={`relative size-full transform-3d transition-transform ease-in-out ${
            faceDown ? 'transform-[rotateY(180deg)]' : ''
          }`}
          // Duration/delay inline so a hand can retune the flip per card (cascade
          // the reveal, then a faster, un-staggered sort flip) — a class can't carry
          // a per-card number.
          style={{ transitionDuration: `${flipMs}ms`, transitionDelay: `${flipDelayMs}ms` }}
        >
          {/* Front face — at rotateY(0). backface-hidden means it vanishes once the
              card turns past 90°, revealing the back behind it. */}
          <div className={`${FACE_BASE} bg-white ${s.radius}`}>
            <Index rank={rank} suit={su} size={s} corner="top" />
            <span className={`absolute inset-0 flex items-center justify-center ${FACE_TEXT} ${s.pip} ${su.color}`}>
              {su.glyph}
            </span>
            <Index rank={rank} suit={su} size={s} corner="bottom" />
          </div>

          {/* Back face — pre-rotated 180° so it reads upright once the whole layer
              turns to 180. Decorative, so it's hidden from assistive tech. */}
          <div aria-hidden className={`${FACE_BASE} ${s.radius} transform-[rotateY(180deg)]`}>
            <Back size={s} />
          </div>
        </div>
      </div>
    </Tag>
  )
}
