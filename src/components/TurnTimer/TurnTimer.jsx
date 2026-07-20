import { useEffect, useRef, useState } from 'react'

// TurnTimer — a countdown ring for the player on turn. Self-contained,
// Tailwind-only. Uses the global animate-countdown token (see index.css).
//
// Two modes:
//   • default — a ring with content in the middle (an avatar, or the digits):
//       <TurnTimer key={turn} seconds={20} onExpire={autoPass}><Avatar … /></TurnTimer>
//   • overlay — JUST the ring, absolutely positioned to FLOAT ON TOP of a
//     sibling. The avatar renders at full size and keeps its own layout; the ring
//     lands over it slightly larger, so it hugs a round avatar without shrinking
//     it into the middle of a bigger box:
//       <div className="relative"><Avatar … /><TurnTimer overlay key={turn} … /></div>
//
// PASS A CHANGING `key` PER TURN. A CSS animation only restarts when the element
// remounts, so re-keying is what re-arms the ring for the next player.
//
// The ring drains entirely in CSS. The digit is derived from the SAME wall clock
// the ring animates against — not a 1s setInterval, which drifts late and lets the
// ring empty while the number still reads 2 — so the two stay locked. It only
// re-renders when the whole second changes.

const SIZES = {
  sm: { box: 'size-14', text: 'text-base', stroke: 10 },
  md: { box: 'size-20', text: 'text-xl', stroke: 8 },
  lg: { box: 'size-24', text: 'text-2xl', stroke: 7 },
}

/**
 * @param seconds   length of a turn
 * @param running   false parks the ring full and stops the clock (not your turn)
 * @param warnAt    seconds remaining at which it turns red
 * @param onExpire  fired once, when the clock hits 0
 * @param children  content for the middle — an avatar. Falls back to the digits.
 */
export default function TurnTimer({
  seconds = 20,
  running = true,
  warnAt = 5,
  size = 'md',
  overlay = false,
  onExpire,
  children,
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md
  const [left, setLeft] = useState(seconds)

  // Read elapsed time off the clock each frame and show the whole seconds left,
  // rounded up — so the digit flips to N exactly as the ring passes the N/total
  // mark, and can't drift behind it the way a setInterval would. setLeft with an
  // unchanged value is a no-op in React, so despite the rAF loop this still only
  // re-renders about once a second (when the number actually changes).
  useEffect(() => {
    setLeft(seconds)
    if (!running) return
    const start = performance.now()
    let raf = 0
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(seconds - (performance.now() - start) / 1000))
      setLeft(remaining)
      if (remaining > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seconds, running])

  // Held in a ref so a caller passing an inline arrow can't re-fire the effect —
  // a fresh function identity every render would otherwise expire on a loop.
  const expireRef = useRef(onExpire)
  expireRef.current = onExpire
  useEffect(() => {
    if (running && left === 0) expireRef.current?.()
  }, [left, running])

  const warn = running && left <= warnAt
  // Outer edge of the stroke lands exactly on the viewBox edge.
  const r = 50 - s.stroke / 2

  // scale(1.06) in overlay so the ring sits just OUTSIDE the avatar's own gold
  // ring rather than on top of it — reads as a ring around the seat, not a second
  // border. rotate(-90) puts the drain's start at 12 o'clock either way.
  const ring = (
    <svg
      viewBox="0 0 100 100"
      className={`absolute inset-0 size-full ${overlay ? '[transform:rotate(-90deg)_scale(1.06)]' : '-rotate-90'}`}
      aria-hidden
    >
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth={s.stroke} className="stroke-black/35" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth={s.stroke}
        strokeLinecap="round"
        // pathLength normalises the circle to 100 units, so the keyframe can
        // run 0 → 100 without knowing the radius.
        pathLength="100"
        strokeDasharray="100"
        className={`transition-[stroke] duration-300 ${warn ? 'stroke-[#E8584F]' : 'stroke-[#9fe03a]'} ${
          running ? 'animate-countdown' : ''
        }`}
        // Duration is set HERE, not via the token's --turn-duration. That token
        // lives on :root, so its `var(--turn-duration, 20s)` resolves against
        // :root — where the var isn't set — and freezes at the 20s fallback; a
        // per-element --turn-duration never reaches it, so the ring drained over
        // 20s no matter the turn (a 5s turn only emptied 1/4). This inline
        // animation-duration outranks the class shorthand and fixes the length.
        style={{ animationDuration: `${seconds}s` }}
      />
    </svg>
  )

  // Screen readers get a number even when the middle holds an avatar.
  const srTimer = (
    <span className="sr-only" role="timer">
      {left} seconds left
    </span>
  )

  // Overlay: the ring alone, floating on top of a sibling. inset-0 fills the
  // relative parent (the avatar's box); z-10 lifts it above the avatar; the ring
  // never eats a tap meant for the seat.
  if (overlay) {
    return (
      <div className={`pointer-events-none absolute inset-0 z-10 ${className}`}>
        {ring}
        {srTimer}
      </div>
    )
  }

  return (
    <div className={`relative ${s.box} ${className}`}>
      {ring}
      {srTimer}
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (
          <span
            className={`font-display leading-none ${s.text} ${
              warn ? 'text-[#FFB3AC] [--stroke-color:#7A1A14]' : 'text-white [--stroke-color:#2f5e0d]'
            }`}
          >
            {left}
          </span>
        )}
      </div>
    </div>
  )
}
