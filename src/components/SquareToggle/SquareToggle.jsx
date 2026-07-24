// Small square toggle chip — used in segmented rows (e.g. Max Players: 2/3/4).
// Controlled via `active`; the parent owns selection state. Self-contained,
// Tailwind-only. Uses the font-display token (Lilita One).

const ON = [
  'border-[#2F6614] bg-linear-to-b from-[#8FE04A] to-[#5BB528]',
  'shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_0_10px_rgba(143,224,74,0.6)]',
].join(' ')

const OFF = [
  'border-[#1B4E86] bg-white/15',
  'shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]',
].join(' ')

export default function SquareToggle({ children, active = false, onClick, className = '', ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-12 cursor-pointer rounded-[14px] border-[3px] px-1.5 py-2 font-display text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active ? ON : OFF
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
