import { useEffect, useMemo, useState } from 'react'

// Confetti — a short, tasteful burst over the felt when a match is won. Composite-
// free and dependency-free: it's just a handful of absolutely-positioned pieces
// animating `transform` + `opacity` only (the confetti-fall keyframe in index.css),
// so it stays on the GPU and is cheap even on a low-end phone. It clips to its own
// box, so drop it into any `relative`/`overflow-hidden` parent as an inset-0 overlay.
//
// SELF-DISMISSING: the pieces fall for `duration`, then the whole thing unmounts
// itself so there's no idle DOM sitting on the table for the rest of the results
// countdown. Re-fire it by changing its React `key` (the boards key it off the
// match, so a new winner re-bursts).
//
// REDUCED MOTION: renders nothing. A shower of moving pieces is the definition of
// gratuitous motion, and the winner's gold glow already carries the moment — so
// under prefers-reduced-motion this simply stands down (also the kindest path for
// battery / weak GPUs).
//
// Pure decoration: it reads no game state and decides nothing.

// Festive palette — house gold leads, then the card-suit colours + white so the
// burst reads as celebratory rather than one flat colour.
const COLORS = ['#FFD27A', '#F5A623', '#E0483C', '#3FA34D', '#2B7FC9', '#FFFFFF']

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * @param count     number of pieces (default 24 — enough to read, cheap to paint)
 * @param duration  ms the burst lasts before it unmounts (default 2500)
 */
export default function Confetti({ count = 24, duration = 2500, className = '' }) {
  const reduce = prefersReducedMotion()
  const [done, setDone] = useState(false)

  // Freeze the random layout once, so a re-render mid-fall doesn't reshuffle the
  // pieces (which would jump them). Recomputed only if count/duration change.
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100, // start x, % across
        dx: Math.round((Math.random() * 2 - 1) * 60), // horizontal drift, px
        spin: Math.round((Math.random() * 2 - 1) * 540), // total rotation, deg
        delay: Math.round(Math.random() * 400), // stagger start, ms
        fall: 2000 + Math.round(Math.random() * 900), // fall length, ms
        w: 5 + Math.round(Math.random() * 4), // px
        h: 8 + Math.round(Math.random() * 6), // px
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.35, // a few discs among the ribbons
      })),
    [count],
  )

  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setDone(true), duration)
    return () => clearTimeout(t)
  }, [reduce, duration])

  if (reduce || done) return null

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-4 block"
          style={{
            left: `${p.left}%`,
            width: `${p.w}px`,
            height: `${p.h}px`,
            background: p.color,
            borderRadius: p.round ? '9999px' : '1px',
            // Per-piece variance drives the shared keyframe (see index.css).
            '--dx': `${p.dx}px`,
            '--spin': `${p.spin}deg`,
            animation: `confetti-fall ${p.fall}ms linear ${p.delay}ms forwards`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  )
}
