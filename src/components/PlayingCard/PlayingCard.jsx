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
//
// EVERY TYPE SIZE HERE SCALES WITH THE BOX, and that is the whole point of the
// table: the card is drawn at four widths and only the md tuning was ever eyeballed,
// so the rest are derived from it as a fraction of the card's width. Hard-coding a
// size on the spans instead has now broken the small cards twice — a 40px suit mark
// on the 48px table card, a 20px rank on the 32px reveal card. If a size looks wrong,
// retune the ROW, don't override it at the call site.
//
//   rank  ~0.31× width — the thing a player actually reads to identify a card
//   glyph ~0.19× width — the small suit under the rank
//   mark  ~0.62× width — the big corner suit (position travels with it)
//
// `corner` places the index. md/lg let the rank ride 4px proud of the top edge
// (there's no overflow clip, and it reads well on a big hand card); xs/sm keep it
// inside, where 4px is a tenth of the card and just looks broken.
// (All literal strings in a lookup, so Tailwind still sees the classes.)
const SIZES = {
  // 32px — an opponent's face-down card, and the end-of-match reveal
  xs: { box: 'h-11 w-8', radius: 'rounded', rank: 'text-[11px]', glyph: 'text-[7px]', corner: 'top-0 left-0.5', mark: 'text-[20px] right-0.5 bottom-0', emblem: 'text-[10px]', lift: '-translate-y-2' },
  // 48px — the trick pile in the middle of the table
  sm: { box: 'h-17 w-12', radius: 'rounded-md', rank: 'text-[17px]', glyph: 'text-[10px]', corner: 'top-0 left-1', mark: 'text-[30px] right-1 bottom-0', emblem: 'text-sm', lift: '-translate-y-2.5' },
  // 64px — your own hand
  md: { box: 'h-22 w-16', radius: 'rounded-lg', rank: 'text-2xl', glyph: 'text-[14px]', corner: '-top-1 left-1', mark: 'text-[40px] right-1 bottom-0.5', emblem: 'text-lg', lift: '-translate-y-4' },
  lg: { box: 'h-28 w-20', radius: 'rounded-xl', rank: 'text-[30px]', glyph: 'text-[18px]', corner: '-top-1 left-1.5', mark: 'text-[50px] right-1.5 bottom-0.5', emblem: 'text-xl', lift: '-translate-y-5' },
}

// Lilita One is the game's voice, but the global outline would ink a navy edge
// around red/black pips on a white face — so this is a [--stroke-width:0] zone.
const FACE_TEXT = 'font-display leading-none [--stroke-width:0]'

// Shared by both faces: the card outline, white fill on the front is set at the
// call site. Kept as one string so the two sides can't drift out of step.
const FACE_BASE = 'absolute inset-0 border-[2px] border-[#1B2733] [backface-visibility:hidden]'

/** Corner index — rank stacked over its suit, top-left. */
function Index({ rank, suit, size }) {
  return (
    <span className={`absolute flex flex-col items-center ${FACE_TEXT} ${suit.color} ${size.corner}`}>
      <span className={size.rank}>{rank}</span>
      <span className={`${size.glyph} -mt-px`}>{suit.glyph}</span>
    </span>
  )
}

/** Front face — the white side. ONE index top-left, and a big suit mark filling the
 *  bottom-right corner. Not a traditional two-index card: a hand is fanned so only a
 *  narrow left strip of each card shows, and the index alone identifies it; the mark
 *  is what makes the card you've LIFTED (or that's sitting on the table, unoccluded)
 *  readable in a glance from across the felt. The mirrored bottom index a paper deck
 *  carries is dead weight here — nothing ever shows this card upside-down.
 *
 *  Its own component so the two faces are SYMMETRIC — `<Front/>` and `<Back/>` —
 *  rather than one component and a loose block of JSX. That keeps the flip layer
 *  below readable as "front here, back there", and means the face's contents can
 *  change without touching the card's 3D plumbing. */
function Front({ rank, suit, size }) {
  return (
    <>
      <Index rank={rank} suit={suit} size={size} />
      {/* Size AND position both come from `size.mark` — a fixed px size looked right
          on the 64px hand card and swallowed the 48px table card whole. */}
      <span className={`absolute ${size.mark} ${FACE_TEXT} ${suit.color}`}>{suit.glyph}</span>
    </>
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
      // The button is the hit area + layout box. HOVER motion never lives here: a
      // target that moves under the cursor loses :hover, falls back and re-triggers
      // — a jitter mouse users feel. That's why the hover scale stays on the inner
      // layer.
      //
      // The SELECTION lift is different and DOES belong here. It's driven by state,
      // not by pointer position, so it can't feed back into a hover loop — and while
      // it sat on the inner layer only, a selected card floated 16px above a hit box
      // that hadn't moved. On a phone you aim at what you SEE, so taps landed in the
      // gap or on the neighbouring card: the "double tap / selects the wrong card"
      // problem. Transform doesn't affect layout, so the fan doesn't reflow.
      className={`group relative block shrink-0 ${s.box} ${s.radius} transition-transform duration-150 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
        selected ? s.lift : ''
      } ${disabled ? 'opacity-45' : interactive ? 'cursor-pointer' : ''} focus:outline-none ${className}`}
    >
      {/* Lift layer — the part that MOVES. Hover pops it up a little and scales it
          a touch; selection raises it further and golds its edge; a press dips it.
          The shadow and the selection outline live here so they travel with the
          lifted card.
          `perspective` sits here because it must wrap the flip layer it gives depth
          to. hover/selected drive `scale` + `translate` (separate CSS props in v4,
          so they compose), and the flip's rotateY is on the child below — three
          layers, zero transform collisions. */}
      <div
        className={`relative size-full ${s.radius} perspective-[700px] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
          // hover lift is skipped while selected so the two don't fight over the
          // raised position — a selected card just sits proud on its own.
          // The gold marker is an OUTLINE with a negative offset, not a ring. A ring
          // is a box-shadow drawn OUTSIDE the box, so a selected card swelled 3px on
          // every edge and lapped its neighbours in the fan. `-outline-offset-3`
          // draws those 3px INSIDE the card's own footprint instead, so selecting
          // changes nothing about the card's size — only its edge colour. Outlines
          // paint on top of descendants (CSS 2.1 painting order), so it lands over
          // the face's dark border rather than behind it.
          // NOTE: the lift itself is on the BUTTON (see above) so the hit area
          // travels with it — only the scale/shadow/outline stay here.
          selected
            ? `scale-[1.04] shadow-[0_10px_16px_rgba(0,0,0,0.45)] outline-3 -outline-offset-3 outline-[#FFD27A]`
            : 'shadow-[0_3px_7px_rgba(0,0,0,0.4)]'
        } ${interactive && !selected && !disabled ? '' : ''} ${
          interactive && !disabled ? '' : ''
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
            <Front rank={rank} suit={su} size={s} />
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
