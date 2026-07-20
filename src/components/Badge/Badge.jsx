// Badge — a small pill/tag holding a heading, with an optional icon in front. A
// top-lit gradient fill (the same cartoon recipe as the Button family), so it reads
// as a glossy label chip. Self-contained, Tailwind-only.
//
// Reusable anywhere a short label needs a coloured chip: a panel heading (like the
// DailyBonus title), a status tag, a category marker. The colour keys match the
// Button / ProgressBar families so a caller can colour-match a badge to them.

// 3D fills — borrowing Card's solid recipe: a THREE-stop top→bottom gradient (light
// crown → mid body → dark base) plus a dark `edge` border, so each chip has real
// depth instead of a flat wash. The bevel shadow (SURFACE below) is shared. Colour
// keys still match the Button / ProgressBar families for colour-matching.
const VARIANTS = {
  green: { edge: 'border-[#2F6614]', fill: 'bg-linear-to-b from-[#8FE04A] via-[#6FCB33] to-[#3F861C]' },
  lime: { edge: 'border-[#5C7A12]', fill: 'bg-linear-to-b from-[#D8FA72] via-[#9FE03A] to-[#7CB520]' },
  blue: { edge: 'border-[#00376B]', fill: 'bg-linear-to-b from-[#6CC3FF] via-[#2B7FC9] to-[#1E5FA0]' },
  red: { edge: 'border-[#7A1A14]', fill: 'bg-linear-to-b from-[#FF9A90] via-[#E8584F] to-[#C73830]' },
}

// The 3D shell, shared by every variant. Card's beveled inset edges (top/left
// highlight, bottom/right shadow) carved into the fill, plus a soft outer drop so
// the chip lifts off the surface. The `edge` colour comes from the variant.
const SURFACE =
  'border-[3px] shadow-[inset_0_3px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(0,0,0,0.28),inset_3px_0_0_rgba(255,255,255,0.18),inset_-3px_0_0_rgba(0,0,0,0.2),0_4px_6px_rgba(0,0,0,0.3)]'

// `box` is the padding with NO icon. When an icon is shown it's taken out of flow
// (absolute, left-middle) as an oversized medallion overhanging the left edge, so
// `padLeft` replaces the left padding to open a gap the exact width of `iconPos` +
// `icon`, keeping the text clear of it. `iconY` centres the medallion per size.
// Mobile-first: the base classes are the compact phone size, `tall:` restores the
// original desktop size at min-height:600px (the app's landscape/desktop breakpoint).
const SIZES = {
  sm: { box: 'px-2.5 py-0.5 tall:px-3 tall:py-1', padLeft: 'pl-8 tall:pl-10', text: 'text-lg tall:text-2xl', icon: 'size-10 tall:size-14', iconPos: '-left-3 tall:-left-4', iconY: 'top-1/2' },
  md: { box: 'px-3 py-1 tall:px-4 tall:py-1.5', padLeft: 'pl-10 tall:pl-13', text: 'text-xl tall:text-3xl', icon: 'size-13 tall:size-18', iconPos: '-left-4 tall:-left-5', iconY: 'top-1/2 tall:top-5' },
  lg: { box: 'px-4 py-1.5 tall:px-5 tall:py-2', padLeft: 'pl-12 tall:pl-16', text: 'text-2xl tall:text-4xl', icon: 'size-16 tall:size-22', iconPos: '-left-4 tall:-left-6', iconY: 'top-1/2' },
}

/**
 * @param children  the heading text (or any node)
 * @param color     'green' | 'lime' | 'blue' | 'red' (default 'green')
 * @param size      'sm' | 'md' | 'lg' (default 'md')
 * @param icon      node shown in FRONT of the heading (emoji / <img> / <svg>)
 * @param showIcon  toggle the leading icon on/off (default true); pass false to
 *                  hide it even when `icon` is supplied
 *
 * `className` merges onto the root (margins, self-alignment, …).
 */
export default function Badge({
  children,
  color = 'green',
  size = 'md',
  icon,
  className = '',
}) {
  const v = VARIANTS[color] ?? VARIANTS.green
  const s = SIZES[size] ?? SIZES.md
  const hasIcon = icon != null

  return (
    <span
      className={`inline-flex w-fit items-center rounded-[22px] ${SURFACE} ${v.edge} ${v.fill} ${s.box} ${hasIcon ? s.padLeft : ''} ${className}`}
    >
      {/* Leading icon — absolute, pinned to the left and vertically centred, so it
          sits over the reserved padLeft gap rather than pushing the text. The size
          classes only bite when the node is an <img>/<svg>; an emoji ignores them
          and rides on the heading's font-size (its box still fills the gap). */}
      {hasIcon && (
        <span
          className={`pointer-events-none absolute -translate-y-1/2 flex items-center justify-center leading-none ${s.iconY} ${s.iconPos} ${s.icon} [&>img]:size-full [&>img]:object-contain [&>svg]:size-full`}
        >
          {icon}
        </span>
      )}
      <span className={`font-display tracking-[0.5px] text-white ${s.text}`}>
        {children}
      </span>
    </span>
  )
}
