import { useId } from 'react'

// CoinIcon — the game's currency mark: a small gilded token that stands in for
// the 🪙 emoji wherever a balance or stake is shown (Header, RoomCard, Profile,
// Table, Shop, Slider, CreateRoomForm).
//
// Drawn in SVG rather than using coin.png: that art is a glowing coin baked onto
// a dark radial background, so inline at text size it shows a murky halo. Vector
// also stays crisp at every size and — the point for this workbench — needs no
// asset file copied alongside the seven components that display a balance.
//
// Sized in em, so it tracks whatever font-size it sits in exactly as the emoji
// did: one component covers text-xs through text-3xl with no per-site tuning.
// `align-[-0.15em]` drops it onto the text baseline so it doesn't ride high
// beside the number.
//
// Palette is the house coin gold — #FFD27A face over #7A4A10 ink — the same pair
// Profile and Shop already stroke their coin totals with.
export default function CoinIcon({ className = '', ...props }) {
  // Gradient ids must be unique per instance: a page full of coins (a Shop grid,
  // a room list) would otherwise share one <defs> id and every coin would pick
  // up whichever definition won. useId is stable across SSR/hydration too.
  const uid = useId()
  const face = `${uid}-face`
  const rim = `${uid}-rim`
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="coins"
      className={`inline-block size-[1.1em] shrink-0 align-[-0.15em] ${className}`}
      {...props}
    >
      <defs>
        <radialGradient id={face} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFF3C8" />
          <stop offset="48%" stopColor="#FFD27A" />
          <stop offset="100%" stopColor="#F0A22E" />
        </radialGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7B84E" />
          <stop offset="100%" stopColor="#B9711A" />
        </linearGradient>
      </defs>

      {/* rim */}
      <circle cx="12" cy="12" r="11" fill={`url(#${rim})`} stroke="#7A4A10" strokeWidth="1.4" />
      {/* face */}
      <circle cx="12" cy="12" r="8.2" fill={`url(#${face})`} stroke="#B9711A" strokeWidth="0.9" />
      {/* engraved inner edge — a faint darker ring for the bevel */}
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#7A4A10" strokeOpacity="0.3" strokeWidth="0.6" />
      {/* center sparkle — reads as a shiny token where fine milling would blur to
          noise at 16px */}
      <path
        d="M12 6.9 L13.15 10.85 L17.1 12 L13.15 13.15 L12 17.1 L10.85 13.15 L6.9 12 L10.85 10.85 Z"
        fill="#FFF6D8"
        fillOpacity="0.92"
      />
      {/* specular highlight */}
      <ellipse cx="8.7" cy="8.1" rx="2.5" ry="1.5" fill="#FFFFFF" fillOpacity="0.5" transform="rotate(-35 8.7 8.1)" />
    </svg>
  )
}
