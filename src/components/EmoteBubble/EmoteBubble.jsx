import { useEffect, useState } from 'react'

// EmoteBubble — the emoji that pops over a player's profile when they emote,
// then gets out of the way. Self-contained, Tailwind-only. Uses the global
// animate-pop-in token (see index.css).
//
// POSITIONING: absolute, like HintBubble. Give the profile a `relative` wrapper
// and drop the bubble in; it pins itself above:
//
//   <div className="relative">
//     <Avatar … />
//     <EmoteBubble emote={player.emote} />
//   </div>
//
// SELF-DISMISSING: it shows when `emote.id` changes and hides itself after
// `duration`. The caller just keeps handing over the latest emote and never has
// to clear it — which matters when the emote arrives on a socket and the parent
// has four seats to babysit.
//
// WHY `emote` IS AN OBJECT, not a bare emoji string: sending 😂 twice in a row is
// the most natural thing in the world, and a bare string wouldn't change, so the
// effect wouldn't re-fire and the second one would silently do nothing. The `id`
// is what makes a repeat a new event.

const SIZES = {
  sm: { box: 'size-9', glyph: 'text-lg', tail: 'size-2.5 -bottom-1' },
  md: { box: 'size-12', glyph: 'text-2xl', tail: 'size-3 -bottom-1.5' },
}

/**
 * @param emote     { id, emoji } — a fresh `id` re-pops it, even for the same emoji
 * @param duration  ms on screen (default 2800)
 * @param size      'sm' | 'md'  (default 'md')
 */
export default function EmoteBubble({ emote, duration = 2800, size = 'md', className = '' }) {
  const s = SIZES[size] ?? SIZES.md
  const [shown, setShown] = useState(false)
  const id = emote?.id

  useEffect(() => {
    if (id == null) return
    setShown(true)
    const t = setTimeout(() => setShown(false), duration)
    // Cleanup restarts the clock on a rapid second emote instead of letting the
    // first one's timer cut the second one short.
    return () => clearTimeout(t)
  }, [id, duration])

  if (!shown || !emote) return null

  return (
    <div
      className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 origin-bottom animate-pop-in ${className}`}
    >
      <div
        className={`relative flex items-center justify-center rounded-full border-[3px] border-[#00376B] bg-white shadow-[0_3px_0_#00376B,0_7px_12px_rgba(0,0,0,0.4)] ${s.box}`}
      >
        <span className={`leading-none ${s.glyph}`}>{emote.emoji}</span>
        {/* Tail — a rotated square keeping only its two outer edges, so just the
            point shows past the bubble. Same trick as HintBubble. */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 rotate-45 rounded-[2px] border-r-[3px] border-b-[3px] border-[#00376B] bg-white ${s.tail}`}
        />
      </div>
    </div>
  )
}
