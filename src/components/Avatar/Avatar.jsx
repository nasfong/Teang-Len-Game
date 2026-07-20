// Avatar — the gold player frame: photo, or the initial as a fallback.
// Self-contained, Tailwind-only. Uses the font-display token (Lilita One).
//
// THE ONE COPY. This lived pasted into Header, Table, RoomCard and FriendList and
// had already forked into two different avatars — the big ones inked #00376B and
// flat, the small ones #1B4E86 with a highlight. Settled on #00376B (Card's
// border, Header's panel edge, Button's outline="navy") so the avatar reads as
// the same chunky object as everything else, and the inset highlight everywhere
// because that dome is the project's bevel language. Add sizes here, not locally.

const SIZES = {
  xs: { box: 'size-8', radius: 'rounded-[10px]', text: 'text-sm', dot: 'size-3' }, // 32px — chat rows
  sm: { box: 'size-11', radius: 'rounded-[14px]', text: 'text-lg', dot: 'size-3.5' }, // 44px — list rows, seats
  md: { box: 'size-16', radius: 'rounded-[18px]', text: 'text-2xl', dot: 'size-4' }, // 64px — table seats
  lg: { box: 'size-21', radius: 'rounded-[22px]', text: 'text-4xl', dot: 'size-5' }, // 84px — header
}

const STATUS_DOT = {
  online: 'bg-[#7CE04A] shadow-[0_0_6px_rgba(124,224,74,0.9)]',
  playing: 'bg-[#FFD27A] shadow-[0_0_6px_rgba(255,210,122,0.9)]',
  offline: 'bg-[#6B7A8C]',
}

// One shadow class per state, never two — the inset dome and the active glow are
// both box-shadow, and Tailwind resolves a collision by stylesheet order rather
// than by which you wrote last. Stacking them into one value sidesteps it.
const DOME = 'shadow-[inset_0_2px_0_rgba(255,255,255,0.45)]'
const DOME_ACTIVE = 'shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_0_18px_rgba(255,210,122,0.85)]'

/**
 * @param name    used for the initial fallback and the photo's alt
 * @param src     photo; falls back to the initial when absent
 * @param size    'xs' | 'sm' | 'md' | 'lg'  (default 'md')
 * @param shape   'rounded' (default, the chunky squircle) | 'circle' (full round,
 *                e.g. table seats, where a countdown ring hugs a circle cleanly)
 * @param status  'online' | 'playing' | 'offline' — adds a corner dot
 * @param active  gold ring + glow (e.g. the seat whose turn it is)
 */
export default function Avatar({ name = '', src, size = 'md', shape = 'rounded', status, active = false, className = '' }) {
  const s = SIZES[size] ?? SIZES.md
  const radius = shape === 'circle' ? 'rounded-full' : s.radius

  return (
    <div className={`relative shrink-0 ${s.box} ${className}`}>
      <div
        className={`flex size-full items-center justify-center overflow-hidden border-[3px] border-[#00376B] bg-linear-to-b from-[#FFE08A] to-[#FFB23E] transition-shadow ${radius} ${
          active ? `ring-4 ring-[#FFD27A] ${DOME_ACTIVE}` : DOME
        }`}
      >
        {src ? (
          // The white mat is load-bearing: a photo fills the frame edge to edge,
          // so without it the gold is completely hidden and the avatar is just a
          // photo in a navy box.
          <img src={src} alt={name} className={`size-full border-[3px] border-white object-cover ${radius}`} />
        ) : (
          <span className={`font-display text-white [--stroke-color:#00376B] ${s.text}`}>
            {name.charAt(0).toUpperCase() || '?'}
          </span>
        )}
      </div>

      {/* Dot sits on the OUTER box, so the frame's overflow-hidden can't clip it */}
      {status && (
        <span
          className={`absolute -right-1 -bottom-1 rounded-full border-2 border-[#00376B] ${s.dot} ${
            STATUS_DOT[status] ?? STATUS_DOT.offline
          }`}
        />
      )}
    </div>
  )
}
