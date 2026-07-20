// ProgressBar — a filled track with an optional count label centred over it
// (e.g. "10/20"). Self-contained, Tailwind-only. Reusable anywhere a fraction or
// percent needs showing: a daily-bonus meter, XP, a download, a vote tally.
//
// The fill is a recessed groove (same inset-shadow recipe as the TextField / stat
// pills) with a bright bar poured into it, so it reads as carved into the panel.
// The label rides ON the bar, centred, with its own text-shadow so it stays legible
// whether it sits over the dark track (low fill) or the bright fill (high).

// Cartoon fills — top-lit gradients so the bar has a little dome. Keys match the
// Button family so a caller can colour-match a bar to a button.
const FILL = {
  green: 'bg-linear-to-b from-[#7BD66F] to-[#3FA34D]',
  lime: 'bg-linear-to-b from-[#C6F76A] to-[#9FE03A]',
  blue: 'bg-linear-to-b from-[#6CC3FF] to-[#2B7FC9]',
  red: 'bg-linear-to-b from-[#FF8A7F] to-[#E8584F]',
}

const SIZES = {
  sm: { track: 'h-4', text: 'text-[11px]' },
  md: { track: 'h-6', text: 'text-sm' },
  lg: { track: 'h-8', text: 'text-base' },
}

/**
 * @param value     current amount (default 0)
 * @param max       the full amount (default 100)
 * @param color     'green' | 'lime' | 'blue' | 'red' (default 'lime')
 * @param label     text over the bar; defaults to `${value}/${max}`. Pass '' to
 *                  compute a percent instead, or any string to override.
 * @param showLabel hide the centred label entirely (default true)
 * @param size      'sm' | 'md' | 'lg' (default 'md')
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  color = 'lime',
  label,
  showLabel = true,
  size = 'md',
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md
  const fill = FILL[color] ?? FILL.lime
  // Clamp so a value past max (or a negative) can't overrun or invert the bar.
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const text = label ?? `${value}/${max}`

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`relative w-full overflow-hidden rounded-full border-2 border-[#1B4E86] bg-black/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)] ${s.track} ${className}`}
    >
      {/* The bar. width animates so a value change slides rather than jumps. */}
      <div
        className={`h-full rounded-full shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] transition-[width] duration-500 ease-out ${fill}`}
        style={{ width: `${pct}%` }}
      />
      {showLabel && text !== '' && (
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center font-display leading-none text-white [--stroke-width:0] [text-shadow:0_1px_2px_rgba(0,0,0,0.75)] ${s.text}`}
        >
          {text}
        </span>
      )}
    </div>
  )
}
