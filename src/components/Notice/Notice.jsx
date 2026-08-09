// Notice — the one inline message pill (failed join, rejected create, claimed reward).
//
// Positioning is the CALLER's: it never places itself, so a floating toast wraps it
// rather than passing a position class in (Trap 1).
//
//   <Notice>Could not join the room.</Notice>
//   <span className="fixed inset-x-0 top-4 z-50 flex justify-center px-4"><Notice size="lg">…</Notice></span>

const TONE = {
  error: 'bg-red-600/90 text-white',
  success: 'bg-black/50 text-[#FFD27A]',
  neutral: 'bg-black/50 text-white/90',
}

const SIZE = {
  sm: 'rounded-lg px-2 py-1 text-xs',
  md: 'rounded-lg px-3 py-2 text-sm',
  lg: 'rounded-xl px-4 py-2 text-sm shadow-lg', // floating-toast weight
}

/**
 * @param tone  'error' | 'success' | 'neutral'
 * @param size  'sm' | 'md' | 'lg'
 */
export default function Notice({ tone = 'error', size = 'md', className = '', children }) {
  return (
    <p
      className={`text-center font-display [--stroke-width:0] ${TONE[tone] ?? TONE.error} ${SIZE[size] ?? SIZE.md} ${className}`}
    >
      {children}
    </p>
  )
}
