// Notice — the one inline message pill: a failed join, a rejected create, a claimed
// reward. Every screen was hand-rolling this same rounded red/gold strip with
// slightly different padding and opacity, which is how they drifted apart.
//
// POSITIONING IS THE CALLER'S. Notice never places itself — it's an in-flow block,
// so a floating toast wraps it in a positioned element rather than passing a
// position class in (Tailwind would emit the root's own classes later and drop it —
// see CLAUDE.md Trap 1).
//
//   <Notice>Could not join the room.</Notice>
//   <Notice tone="success">🎉 +500 coins!</Notice>
//   <span className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
//     <Notice size="lg">{error.message}</Notice>
//   </span>

const TONE = {
  error: 'bg-red-600/90 text-white',
  success: 'bg-black/50 text-[#FFD27A]',
  neutral: 'bg-black/50 text-white/90',
}

const SIZE = {
  sm: 'rounded-lg px-2 py-1 text-xs',
  md: 'rounded-lg px-3 py-2 text-sm',
  lg: 'rounded-xl px-4 py-2 text-sm shadow-lg',
}

/**
 * @param tone  'error' | 'success' | 'neutral'
 * @param size  'sm' | 'md' | 'lg' — lg is the floating-toast weight (adds a shadow)
 */
export default function Notice({ tone = 'error', size = 'md', className = '', children }) {
  return (
    <p
      // [--stroke-width:0]: small copy on a solid fill, so the display outline would
      // only muddy it (CLAUDE.md, "font-display carries an outline").
      className={`text-center font-display [--stroke-width:0] ${TONE[tone] ?? TONE.error} ${SIZE[size] ?? SIZE.md} ${className}`}
    >
      {children}
    </p>
  )
}
