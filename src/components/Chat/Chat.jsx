import { useLayoutEffect, useRef, useState } from 'react'
import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import TextField from '../TextField/TextField.jsx'

// Chat — the room's message panel. Composite (Card + Avatar + Button + TextField),
// so copying it out brings all four folders.
//
// Messages are owned by the caller (they arrive over a socket); only the draft in
// the composer is local. Reports out via onSend(text).
//
//   <Chat messages={messages} onSend={(t) => socket.emit('chat', t)} />
//
// SIZING: no width of its own — it fills the column a sidebar gives it, like
// FriendList. The list caps at max-h-80 and scrolls.

const SEND_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** One message. `grouped` means the previous row was the same speaker, so the
 *  avatar and name are dropped — a run of messages reads as one person talking
 *  rather than a wall of repeated headers. */
function Message({ name, text, avatarSrc, you = false, system = false, grouped = false }) {
  if (system) {
    return (
      <p className="py-0.5 text-center font-display text-xs text-white/45 [--stroke-width:0]">{text}</p>
    )
  }

  return (
    <div className="flex gap-2">
      {/* Reserve the gutter even when grouped, so a run stays aligned */}
      <div className="w-8 shrink-0">{!grouped && <Avatar name={name} src={avatarSrc} size="xs" />}</div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <span className={`font-display text-xs [--stroke-width:0] ${you ? 'text-[#FFD27A]' : 'text-white/60'}`}>
            {name}
          </span>
        )}
        {/* wrap-break-word or a pasted URL blows the panel's width out */}
        <p className="font-display text-sm leading-snug wrap-break-word text-white [--stroke-width:0]">{text}</p>
      </div>
    </div>
  )
}

export default function Chat({
  messages = [],
  onSend,
  title = 'Chat',
  placeholder = 'Say something…',
  maxLength = 200,
  disabled = false,
  emptyText = 'No messages yet — say hi!',
  className = '',
}) {
  const [draft, setDraft] = useState('')
  const listRef = useRef(null)
  // Whether the view is pinned to the bottom. A ref, not state — it changes on
  // every scroll event and nothing renders from it.
  const stuckRef = useRef(true)

  function handleScroll() {
    const el = listRef.current
    if (!el) return
    stuckRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  // Follow new messages, but ONLY if the reader is already at the bottom —
  // yanking someone back down mid-scroll while they're reading history is the
  // classic chat bug. useLayoutEffect so the jump happens before paint.
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stuckRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function submit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || disabled) return
    onSend?.(text)
    setDraft('')
    // A message you sent yourself always scrolls into view, wherever you were.
    stuckRef.current = true
  }

  return (
    <Card className={`w-full flex-col gap-2.5 p-3 ${className}`}>
      <div className="px-1 font-display text-xl text-white [--stroke-color:#0F3358]">💬 {title}</div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex max-h-80 min-h-40 flex-col gap-2 overflow-y-auto rounded-2xl bg-black/20 p-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
      >
        {messages.length === 0 ? (
          <p className="m-auto px-2 text-center font-display text-sm text-white/50 [--stroke-width:0]">{emptyText}</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1]
            return (
              <Message
                key={m.id ?? i}
                {...m}
                grouped={!m.system && !!prev && !prev.system && prev.name === m.name}
              />
            )
          })
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <TextField
          className="flex-1"
          placeholder={placeholder}
          value={draft}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
        />
        {/* Circle so the composer stays compact in a narrow panel; md (46px) is
            the size that sits closest to TextField's height without a gap. */}
        <Button
          type="submit"
          shape="circle"
          variant="green"
          aria-label="Send"
          disabled={disabled || !draft.trim()}
        >
          {SEND_ICON}
        </Button>
      </form>
    </Card>
  )
}
