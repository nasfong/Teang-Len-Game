// HintBubble — a cartoon speech bubble for field messages (validation, tips).
// Pops in with a springy bounce and points a tail back at whatever it sits by.
// Self-contained, Tailwind-only. Uses the font-display token (Lilita One).
//
// POSITIONING: absolute, like a Chakra tooltip — it floats beside the field
// rather than taking layout space, so a message appearing never shoves the form
// down. Give the field a `relative` wrapper and drop the bubble inside it:
//
//   <div className="relative">
//     <TextField … />
//     <HintBubble placement="right">Enter your username</HintBubble>
//   </div>
//
// The wrapper must not be `overflow-hidden` — the bubble deliberately spills
// outside it.

// Each variant tints its fill rather than sitting on flat white, so the tone
// reads before you get to the words. `edge` is the solid 3D bottom lip + ground
// shadow, matching the chunky look of Button/Card.
const VARIANTS = {
  error: {
    bg: 'bg-[#FFF1EF]',
    border: 'border-[#E0524A]',
    edge: 'shadow-[0_3px_0_#C73830,0_7px_14px_rgba(0,0,0,0.22)]',
    text: 'text-[#B3241B]',
    icon: '⚠️',
  },
  info: {
    bg: 'bg-[#EFF6FF]',
    border: 'border-[#2B7FC9]',
    edge: 'shadow-[0_3px_0_#1E5FA0,0_7px_14px_rgba(0,0,0,0.22)]',
    text: 'text-[#15406F]',
    icon: '💡',
  },
  success: {
    bg: 'bg-[#F3FBEB]',
    border: 'border-[#54B23A]',
    edge: 'shadow-[0_3px_0_#2F6614,0_7px_14px_rgba(0,0,0,0.22)]',
    text: 'text-[#2F6614]',
    icon: '✅',
  },
}

// Chakra's 12 placements. `placement` names where the BUBBLE goes relative to the
// field — so "right" means the bubble sits to the field's right and its tail
// points back left. -start / -end align to the field's leading / trailing edge
// instead of centring.
//
// `box`    — pins the bubble against the anchor's edge (`*-full`) + a 10px gap.
// `tail`   — the rotated square: the two bordered sides are the corner that ends
//            up facing the field, so only that point shows past the bubble.
// `origin` — scale origin for the pop-in, so it grows OUT of the field.
const PLACEMENTS = {
  top: {
    box: 'bottom-full left-1/2 -translate-x-1/2 mb-2.5',
    tail: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r-[3px] border-b-[3px]',
    origin: 'origin-bottom',
  },
  'top-start': {
    box: 'bottom-full left-0 mb-2.5',
    tail: 'bottom-0 left-6 translate-y-1/2 border-r-[3px] border-b-[3px]',
    origin: 'origin-bottom-left',
  },
  'top-end': {
    box: 'bottom-full right-0 mb-2.5',
    tail: 'bottom-0 right-6 translate-y-1/2 border-r-[3px] border-b-[3px]',
    origin: 'origin-bottom-right',
  },
  bottom: {
    box: 'top-full left-1/2 -translate-x-1/2 mt-2.5',
    tail: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t-[3px] border-l-[3px]',
    origin: 'origin-top',
  },
  'bottom-start': {
    box: 'top-full left-0 mt-2.5',
    tail: 'top-0 left-6 -translate-y-1/2 border-t-[3px] border-l-[3px]',
    origin: 'origin-top-left',
  },
  'bottom-end': {
    box: 'top-full right-0 mt-2.5',
    tail: 'top-0 right-6 -translate-y-1/2 border-t-[3px] border-l-[3px]',
    origin: 'origin-top-right',
  },
  right: {
    box: 'left-full top-1/2 -translate-y-1/2 ml-2.5',
    tail: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 border-b-[3px] border-l-[3px]',
    origin: 'origin-left',
  },
  'right-start': {
    box: 'left-full top-0 ml-2.5',
    tail: 'top-4 left-0 -translate-x-1/2 border-b-[3px] border-l-[3px]',
    origin: 'origin-top-left',
  },
  'right-end': {
    box: 'left-full bottom-0 ml-2.5',
    tail: 'bottom-4 left-0 -translate-x-1/2 border-b-[3px] border-l-[3px]',
    origin: 'origin-bottom-left',
  },
  left: {
    box: 'right-full top-1/2 -translate-y-1/2 mr-2.5',
    tail: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 border-t-[3px] border-r-[3px]',
    origin: 'origin-right',
  },
  'left-start': {
    box: 'right-full top-0 mr-2.5',
    tail: 'top-4 right-0 translate-x-1/2 border-t-[3px] border-r-[3px]',
    origin: 'origin-top-right',
  },
  'left-end': {
    box: 'right-full bottom-0 mr-2.5',
    tail: 'bottom-4 right-0 translate-x-1/2 border-t-[3px] border-r-[3px]',
    origin: 'origin-bottom-right',
  },
}

// Floating, so it can't inherit a width — `w-max` sizes it to the message and
// max-w wraps anything long instead of stretching off the page.
const BOX = 'absolute z-20 inline-flex w-max max-w-55 items-center gap-2 rounded-[14px] border-[3px] px-3 py-1.5 animate-pop-in'

/**
 * @param placement  where the BUBBLE sits relative to the field (Chakra's 12):
 *                   'top' | 'top-start' | 'top-end' | 'right' | 'right-start' |
 *                   'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' |
 *                   'left' | 'left-start' | 'left-end'   (default 'right')
 */
export default function HintBubble({ children, variant = 'error', placement = 'right', icon, className = '' }) {
  const v = VARIANTS[variant] ?? VARIANTS.error
  const p = PLACEMENTS[placement] ?? PLACEMENTS.right
  const glyph = icon ?? v.icon

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`${BOX} ${p.box} ${p.origin} ${v.bg} ${v.border} ${v.edge} ${className}`}
    >
      {/* Tail — same fill + border as the bubble, so it reads as a pointer */}
      <span className={`absolute size-3 rotate-45 rounded-[3px] ${v.bg} ${v.border} ${p.tail}`} />
      {glyph && (
        <span className="relative shrink-0 text-base leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">{glyph}</span>
      )}
      {/* bubble copy is small + dark on a light fill, so opt out of the global outline */}
      <span className={`relative font-display text-sm leading-tight tracking-[0.2px] [--stroke-width:0] ${v.text}`}>
        {children}
      </span>
    </div>
  )
}
