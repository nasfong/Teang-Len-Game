// Chunky 3D game button (merges the old PlayButton + PillButton).
//
// Two layers: the slab is pinned to the face's exact box (`absolute inset-0`) and
// pushed down by --depth to form the 3D thickness, so it always matches the face's
// size and radius by construction. The face sinks by the same --depth on press,
// landing flush on the slab. Interaction is pure CSS — no state, works on touch.
//
// Variant sets the palette, size sets the geometry (+ --depth on the root, which
// both layers read). Tailwind-only; uses the font-display token (Lilita One).

// `edge`/`label` are kept OUT of the slab/face gradients so the outline prop can
// swap them — two border-color classes on one element would collide (Tailwind
// resolves by source order, not class order).
// Gradients keep the original stops (slab base→dark, face 0% / 55% / 100%).
const VARIANTS = {
  lime: {
    edge: 'border-[#2f5e0d]',
    label: '[--stroke-color:#2f5e0d]',
    slab: 'bg-[linear-gradient(180deg,#5aa81c_0%,#3d7d12_100%)]',
    face: 'bg-[linear-gradient(180deg,#c2f051_0%,#9fe03a_55%,#7cc42a_100%)]',
  },
  green: {
    edge: 'border-[#2F6614]',
    label: '[--stroke-color:#2F6614]',
    slab: 'bg-[linear-gradient(180deg,#3F861C_0%,#2F6614_100%)]',
    face: 'bg-[linear-gradient(180deg,#8FE04A_0%,#6FCB33_55%,#5BB528_100%)]',
  },
  blue: {
    edge: 'border-[#15406F]',
    label: '[--stroke-color:#15406F]',
    slab: 'bg-[linear-gradient(180deg,#1E5FA0_0%,#15406F_100%)]',
    face: 'bg-[linear-gradient(180deg,#65B7F2_0%,#3C93DB_55%,#2B7FC9_100%)]',
  },
  red: {
    edge: 'border-[#7A1A14]',
    label: '[--stroke-color:#7A1A14]',
    slab: 'bg-[linear-gradient(180deg,#A8291F_0%,#7A1A14_100%)]',
    face: 'bg-[linear-gradient(180deg,#F0665D_0%,#E8584F_55%,#C73830_100%)]',
  },
}

// Shared dark-navy ink — the same edge Header/Card use, for one inked family.
const NAVY = {
  edge: 'border-[#00376B]',
  label: '[--stroke-color:#00376B]',
}

// sizeTall (see Button below) builds `tall:`-prefixed geometry at RUNTIME via
// string concat — which Tailwind's JIT scanner cannot see, so those classes would
// never be emitted. Tailwind scans raw file text (comments included), so listing
// the tokens literally here makes the scanner generate them. Keep in sync with the
// `xl` pill + icon geometry below — the only sizes used as `sizeTall` today:
//   tall:[--depth:8px] tall:rounded-[32px] tall:rounded-[22px]
//   tall:px-[64px] tall:py-[20px] tall:size-[90px] tall:p-3
//   tall:text-[40px] tall:top-3 tall:left-2 tall:left-3 tall:h-1.5 tall:w-4
//
// Geometry, keyed by shape then size. `radius` goes on BOTH layers so their
// silhouettes match; `sheen` sizes/places the top-left glossy light.
// `box` is what gives the face its size: padding around a label for a pill, a
// fixed square for a circle (icon-only) — one slot, two ways of being sized.
const SIZES = {
  pill: {
    sm: { depth: '[--depth:3px]', radius: 'rounded-[18px]', box: 'px-6 py-2', text: 'text-lg', sheen: 'top-1.5 left-1 h-0.5 w-2' },
    md: { depth: '[--depth:4px]', radius: 'rounded-[22px]', box: 'px-9 py-2.5', text: 'text-[22px]', sheen: 'top-2 left-1.5 h-1 w-3' },
    lg: { depth: '[--depth:6px]', radius: 'rounded-[26px]', box: 'px-[50px] py-[15px]', text: 'text-[32px]', sheen: 'top-2.5 left-1.5 h-1 w-3.5' },
    xl: { depth: '[--depth:8px]', radius: 'rounded-[32px]', box: 'px-[64px] py-[20px]', text: 'text-[40px]', sheen: 'top-3 left-2 h-1.5 w-4' },
  },
  // md is 46px — the size the original floating Back button used.
  circle: {
    sm: { depth: '[--depth:3px]', radius: 'rounded-full', box: 'size-9', text: 'text-lg', sheen: 'top-1.5 left-1.5 h-0.5 w-2' },
    md: { depth: '[--depth:4px]', radius: 'rounded-full', box: 'size-[46px]', text: 'text-[22px]', sheen: 'top-2 left-2 h-1 w-3' },
    lg: { depth: '[--depth:6px]', radius: 'rounded-full', box: 'size-14', text: 'text-[32px]', sheen: 'top-2.5 left-2.5 h-1 w-3.5' },
    xl: { depth: '[--depth:8px]', radius: 'rounded-full', box: 'size-[72px]', text: 'text-[40px]', sheen: 'top-3 left-3 h-1.5 w-4' },
  },
  // Icon-only like circle — square box, pill radii (a squircle) — but with inner
  // PADDING so the icon breathes off the edges. box-border means the p-* eats into
  // the size, so the box is bumped up to keep a roomy content area: the padding is
  // the visible ring between the icon and the button edge, not a squeeze on the art.
  icon: {
    sm: { depth: '[--depth:3px]', radius: 'rounded-[18px]', box: 'size-11 p-1.5', text: 'text-lg', sheen: 'top-1.5 left-1.5 h-0.5 w-2' },
    md: { depth: '[--depth:4px]', radius: 'rounded-[22px]', box: 'size-[54px] p-2', text: 'text-[22px]', sheen: 'top-2 left-2 h-1 w-3' },
    lg: { depth: '[--depth:6px]', radius: 'rounded-[22px]', box: 'size-16 p-2', text: 'text-[32px]', sheen: 'top-2.5 left-2.5 h-1 w-3.5' },
    xl: { depth: '[--depth:8px]', radius: 'rounded-[22px]', box: 'size-[90px] p-3', text: 'text-[40px]', sheen: 'top-3 left-3 h-1.5 w-4' },
  },
}

// A pill's label sets its own width; a circle has a fixed box and must centre
// whatever sits in it. Kept off FACE — two display classes would collide.
const LAYOUT = { pill: 'block', circle: 'flex items-center justify-center', icon: 'flex items-center justify-center' }

// Base slab — the face's twin, shifted down to become the 3D thickness.
const SLAB = 'pointer-events-none absolute inset-0 translate-y-[var(--depth)] border-[3px]'

// Face — sits above the slab and defines the box size. `display` comes from
// LAYOUT (per shape), so it isn't baked in here.
//
// NO BOTTOM BORDER (the original's `borderBottom: 'none'`). The face's gradient
// runs straight into the slab's, so the 3D thickness reads as one solid edge and
// the ink stays a clean outline around the whole shape. A bottom border instead
// draws a line ACROSS that edge: harmless with outline="variant", where it's the
// variant's own dark tone and disappears into the slab — but outline="navy" cuts
// a foreign navy stripe through a green button's thickness, leaving a 3px sliver
// of green marooned between two navy lines.
//
// Sides are declared individually rather than `border-[3px] border-b-0`: the
// shorthand and the longhand are two width classes on one element, and Tailwind
// resolves that by stylesheet order rather than by who asked last. Naming only
// the sides that exist has no collision to lose.
const FACE = [
  'relative cursor-pointer overflow-hidden border-x-[3px] border-t-[3px]',
  // inset edges: top/left highlight, bottom/right shadow — the beveled look
  'shadow-[inset_0_3px_0_rgba(255,255,255,0.4),inset_0_-3px_0_rgba(0,0,0,0.25),inset_3px_0_0_rgba(255,255,255,0.2),inset_-3px_0_0_rgba(0,0,0,0.2)]',
  'transition-transform duration-[130ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]',
  // press: sink by exactly the slab's offset so the face lands flush on it
  'hover:-translate-y-[1.5px] active:translate-y-[var(--depth)]',
  'disabled:cursor-default disabled:hover:translate-y-0',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
].join(' ')

const SHEEN = 'pointer-events-none absolute rotate-140 rounded-[100%] bg-white blur-[0.6px]'

// font-display brings the outline with it (see index.css); variants only set the
// ink color via --stroke-color.
const LABEL =
  'font-display leading-none whitespace-nowrap text-white select-none [text-shadow:0_4px_4px_rgba(20,60,10,0.40)]'

/**
 * Button — chunky 3D game button.
 *
 * @param variant  'lime' | 'green' | 'blue' | 'red'   (default 'green')
 * @param size     'sm' | 'md' | 'lg' | 'xl'           (default 'md')
 * @param sizeTall optional larger size restored at the `tall:` breakpoint
 *                 (min-height:600px). Pass a compact `size` for phones and a
 *                 bigger `sizeTall` for desktop — each geometry class gets a
 *                 `tall:` copy, so the big set wins only on tall screens. Omit
 *                 for a size that's the same everywhere.
 * @param shape    'pill'   — label sets the width (default)
 *                 'circle' — fixed square box, round, for an icon on its own
 *                 'icon'   — fixed square box, rounded corners (a squircle) — an
 *                            icon on its own but matching the pill's radius
 * @param outline  'variant' — edge matches the variant's own dark tone (original)
 *                 'navy'    — shared #00376B ink, matching Header/Card
 *                 (default 'variant')
 * @param glossy   top-left sheen highlight (default true) — pass false for a
 *                 flat face, e.g. a small button where the dot reads as a smudge
 *
 * `className` merges onto the root wrapper (margins, z-index, …); extra props
 * (onClick, disabled, type, …) spread onto the underlying <button>.
 *
 * DON'T pass a position class — the root is `relative` so SLAB's `absolute
 * inset-0` has something to anchor to, and Tailwind resolves two position
 * classes by stylesheet order (`.relative` is emitted after `.absolute`, so it
 * wins) rather than by the order you write them. Yours would be silently
 * dropped. To place a button, wrap it:
 *   <span className="absolute top-4 left-4"><Button …/></span>
 *
 * An icon-only button has no text for a screen reader to read, so pass
 * aria-label: <Button shape="circle" variant="blue" aria-label="Back">{svg}</Button>
 */
export default function Button({
  children,
  variant = 'green',
  size = 'md',
  sizeTall,
  shape = 'pill',
  outline = 'variant',
  glossy = true,
  disabled = false,
  className = '',
  ...props
}) {
  const v = VARIANTS[variant] ?? VARIANTS.green
  const sizes = SIZES[shape] ?? SIZES.pill
  const s = sizes[size] ?? sizes.md
  const ink = outline === 'navy' ? NAVY : v

  // When sizeTall is given, emit a `tall:`-prefixed copy of each geometry class so
  // the bigger set kicks in on tall screens (the compact `size` is the phone base).
  // Each SIZES value is a space-joined class list, so prefix every token.
  const st = sizeTall ? (sizes[sizeTall] ?? s) : null
  const tall = (key) => (st ? ' ' + st[key].split(' ').map((c) => `tall:${c}`).join(' ') : '')

  return (
    <div
      className={`relative inline-block ${s.depth}${tall('depth')} drop-shadow-[0_8px_10px_rgba(30,70,15,0.38)] ${
        disabled ? 'opacity-60' : ''
      } ${className}`}
    >
      <div aria-hidden className={`${SLAB} ${s.radius}${tall('radius')} ${ink.edge} ${v.slab}`} />
      <button
        type="button"
        disabled={disabled}
        className={`${FACE} ${LAYOUT[shape] ?? LAYOUT.pill} ${s.radius}${tall('radius')} ${ink.edge} ${s.box}${tall('box')} ${v.face}`}
        {...props}
      >
        {/* Glossy top-left sheen — soft 140° diagonal light. On by default; it's
            decoration, so glossy={false} just drops it rather than hiding it. */}
        {glossy && <span aria-hidden className={`${SHEEN} ${s.sheen}${tall('sheen')}`} />}
        {/* Wraps an icon too: the text classes go inert on an <svg>, but text-white
            still sets the currentColor an icon can stroke/fill itself with. */}
        <span className={`${LABEL} ${s.text}${tall('text')} ${ink.label}`}>{children}</span>
      </button>
    </div>
  )
}
