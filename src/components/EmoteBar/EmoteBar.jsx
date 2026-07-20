import { useState } from 'react'
import Button from '../Button/Button.jsx'

// EmoteBar — the emote picker. Composite (wraps Button), so copying it out brings
// that folder too. Pairs with EmoteBubble: this picks, that displays.
//
//   <EmoteBar onPick={(emoji) => socket.emit('emote', emoji)} />
//
// COLLAPSED BY DEFAULT. A table is crowded and an always-on row of six buttons
// competes with the cards; tapping 😀 opens it and picking closes it again. Pass
// `open` to pin it permanently (a wide lobby has the room).
//
// `cooldown` is the point of the component as much as the emoji are: without it,
// emotes are a spam vector aimed at whoever is trying to think about their hand.

const DEFAULT_EMOTES = ['👍', '😂', '😮', '😎', '😡', '🎉']

/**
 * @param emotes    emoji to offer
 * @param onPick    (emoji) => void
 * @param open      true pins the row open and hides the toggle
 * @param cooldown  ms to lock the bar after a pick (default 2000, 0 disables)
 */
export default function EmoteBar({
  emotes = DEFAULT_EMOTES,
  onPick,
  open,
  cooldown = 2000,
  disabled = false,
  className = '',
}) {
  const pinned = open === true
  const [expanded, setExpanded] = useState(false)
  const [cooling, setCooling] = useState(false)
  const showing = pinned || expanded
  const locked = disabled || cooling

  function pick(emoji) {
    if (locked) return
    onPick?.(emoji)
    if (!pinned) setExpanded(false)
    if (cooldown > 0) {
      setCooling(true)
      setTimeout(() => setCooling(false), cooldown)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!pinned && (
        <Button
          shape="circle"
          size="sm"
          variant="blue"
          outline="navy"
          glossy={false}
          aria-label={expanded ? 'Close emotes' : 'Open emotes'}
          aria-expanded={expanded}
          disabled={disabled}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '✕' : '😀'}
        </Button>
      )}

      {showing &&
        emotes.map((emoji) => (
          <Button
            key={emoji}
            shape="circle"
            size="sm"
            variant="blue"
            outline="navy"
            glossy={false}
            aria-label={`Send ${emoji}`}
            disabled={locked}
            onClick={() => pick(emoji)}
          >
            {emoji}
          </Button>
        ))}
    </div>
  )
}
