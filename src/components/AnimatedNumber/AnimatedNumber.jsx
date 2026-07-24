import { useEffect, useRef, useState } from 'react'

// AnimatedNumber — a number that rolls from its old value to its new one when the
// `value` prop changes, instead of snapping. Used for the coin balances that jump at
// match settlement, so a win/loss reads as the count ticking up/down. Tweens
// `transform`-free (just re-renders the formatted integer each frame via rAF), which
// is plenty cheap for the few seats on a table.
//
// First render shows `value` with no animation — only later CHANGES animate. An
// interrupted tween picks up from whatever is currently on screen, so rapid updates
// never jump. Honors prefers-reduced-motion by snapping.

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// easeOutCubic — fast start, gentle settle, the usual "coins landing" feel.
const ease = (t) => 1 - Math.pow(1 - t, 3)

/**
 * @param value     the target number
 * @param duration  ms for the roll (default 700)
 * @param format    number → string (default toLocaleString)
 */
export default function AnimatedNumber({ value, duration = 700, format = (n) => n.toLocaleString(), className = '' }) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value) // what's on screen right now — the roll's start point
  const rafRef = useRef(null)

  useEffect(() => {
    const to = value
    const from = displayRef.current
    if (from === to) return
    if (prefersReducedMotion()) {
      displayRef.current = to
      setDisplay(to)
      return
    }
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const cur = Math.round(from + (to - from) * ease(t))
      displayRef.current = cur
      setDisplay(cur)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
