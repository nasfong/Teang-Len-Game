import { useEffect, useState } from 'react'

// PhaseBanner — "a new phase started" caption for the middle of a table. Content is
// data (icon/title/note), so any phase reuses it. Self-dismissing on a changing
// `event.id`, like EmoteBubble — the caller never clears it.
//
//   const CHALLENGE = { id: 'final-challenge', icon: '⚔️', title: 'FINAL CHALLENGE' }
//   <PhaseBanner event={challengeOpen ? CHALLENGE : null} />

/**
 * @param event     { id, icon?, title, note? } | null — a fresh `id` re-announces
 * @param duration  ms on screen, animation included (default 2600)
 */
export default function PhaseBanner({ event, duration = 2600, className = '' }) {
  const [shown, setShown] = useState(false)
  const id = event?.id

  useEffect(() => {
    if (id == null) return
    setShown(true)
    const t = setTimeout(() => setShown(false), duration)
    return () => clearTimeout(t)
  }, [id, duration])

  if (!shown || !event) return null

  // Inline, not a class: every layer's animation has to run for the caller's duration,
  // and inline beats the token's own length (the TurnTimer/animate-countdown pattern).
  const timing = { animationDuration: `${duration}ms` }

  return (
    // z-30 clears the seats (z-10) and the winner's stack (z-20).
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center ${className}`}
    >
      {/* Lime bloom behind the panel — lifts it off a busy felt without dimming the
          table the way a full scrim would. */}
      <span
        aria-hidden
        style={timing}
        className="absolute size-105 max-w-none animate-announce-glow rounded-full bg-[radial-gradient(circle,rgba(159,224,58,0.20),transparent_65%)]"
      />

      <div
        style={timing}
        className="relative flex animate-announce items-center gap-3.5 overflow-hidden rounded-2xl border border-white/20 bg-linear-to-b from-[#14406c]/95 to-[#0a2440]/95 px-5 py-3 whitespace-nowrap shadow-[0_18px_40px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.22)]"
      >
        {/* Lime hairline along the top edge, fading out at both ends. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#c2f051] to-transparent" />

        {/* One light sweep across the panel as it lands. `overflow-hidden` on the panel
            is what keeps it from showing before and after the pass. */}
        <span
          aria-hidden
          style={timing}
          className="absolute inset-y-0 -left-1/4 w-1/4 skew-x-[-20deg] animate-announce-sheen bg-linear-to-r from-transparent via-white/25 to-transparent"
        />

        {event.icon && (
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-[#c2f051]/40 bg-[#9fe03a]/15 text-2xl leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">
            <span aria-hidden>{event.icon}</span>
          </span>
        )}

        <span className="relative flex flex-col">
          <span className="font-display text-[26px] leading-none tracking-wide text-white">{event.title}</span>
          {event.note && (
            <span className="mt-1.5 font-display text-[11px] leading-none tracking-[0.14em] text-[#c2f051] uppercase [--stroke-width:0]">
              {event.note}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
