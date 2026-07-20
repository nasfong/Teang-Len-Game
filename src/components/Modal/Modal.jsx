import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'

// Modal — a dimmed backdrop with a Card panel sprung in over it. Composite
// (Card surface + a circle Button to close), so copying it out brings both
// folders too. Uses font-display + the global animate-pop-in / animate-fade-in.
//
// Controlled: it renders nothing unless `open`. Reports out via onClose(), which
// fires on the ✕, Escape, and a backdrop click.
//
//   <Modal open={open} title="Leave room?" onClose={() => setOpen(false)}>
//     …
//   </Modal>
//
// THE PANEL IS THE MODAL'S JOB: content goes in bare. CreateRoomForm and AuthForm
// already bring their own Card, so nesting one here would stack two panels —
// render those on their own, or strip their Card first.
//
// `deco` pins playing-card art along the panel's side borders — a flourish for a
// headline moment (creating a room), not something every confirm dialog should
// wear, so it's opt-in:
//
//   <Modal open={open} deco heading="CREATE ROOM">…</Modal>
//
// The art itself now lives on Card (any Card can wear `deco`); Modal just forwards
// the prop. Modal keeps ONE deco-aware detail of its own — the horizontal clip on
// its scroll container (see overflow-x-clip below) — because that's about the
// modal's viewport, not the panel. An undecorated Modal renders exactly as before.

// A modal owns its width (nothing else can centre it in a viewport), unlike the
// list components that inherit theirs from a parent.
const SIZES = {
  sm: 'max-w-90', // 360px — confirms, short prompts
  md: 'max-w-115', // 460px — the CreateRoomForm-sized default
  lg: 'max-w-150', // 600px — wide content
}

export default function Modal({
  open = false,
  heading,
  title,
  children,
  onClose,
  size = 'md',
  variant = 'solid',
  closable = true,
  deco = false,
  className = '',
}) {
  // Escape to close. Bound to the document, not the panel, so it works before
  // anything inside has been focused.
  useEffect(() => {
    if (!open || !closable) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, closable, onClose])

  // Freeze the page behind the modal — otherwise scrolling over the backdrop
  // scrolls the page under it. Restores whatever was there rather than assuming
  // it was the default, so nested/consecutive modals can't strand it hidden.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Hooks run unconditionally above; only the render bails out early. Because the
  // Card unmounts here while closed and remounts on the next open, Card deals a
  // fresh deco hand each open on its own — no open-tracking needed in Modal.
  if (!open) return null

  return createPortal(
    <div
      // overflow-x-clip guards the border cards' outer halves. overflow-y-auto
      // (needed so a tall modal scrolls) forces overflow-x from `visible` to
      // `auto` per spec, so on a phone — where the panel fills the width and the
      // deco hangs ~24px past the viewport — the panel would gain a horizontal
      // scrollbar and drift sideways under the thumb. `clip` is deliberate over
      // `hidden`: hidden is a scroll container that merely hides its bars, so it
      // would still scroll programmatically and on focus.
      // Only when decorated: a clip here would also trim anything a plain modal
      // legitimately hangs outside itself, so an undecorated Modal keeps the
      // exact overflow behaviour it had before any of this existed.
      className={`fixed inset-0 z-50 flex overflow-y-auto p-4 ${deco ? 'overflow-x-clip' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        aria-hidden
        onClick={closable ? onClose : undefined}
        className="fixed inset-0 bg-black/60 backdrop-blur-[3px] animate-fade-in"
      />
      {/* deco is forwarded to Card — it owns the border art (and the `isolate` +
          -z-10 stacking that makes it sit on the border yet under the content). */}
      <Card
        variant={variant}
        deco={deco}
        className={`m-auto w-full ${SIZES[size] ?? SIZES.md} flex-col p-6 animate-pop-in ${className}`}
      >
        {closable && (
          <span className="absolute -top-3 -right-3 z-10">
            <Button shape="circle" size="sm" variant="red" outline="navy" aria-label="Close" onClick={onClose}>
              ✕
            </Button>
          </span>
        )}

        {/* Straddles the card's top edge. `inset-x-0` rather than the usual
            left-1/2 + -translate-x-1/2: an absolute element given only `left` is
            sized shrink-to-fit against the space LEFT OF ITS RIGHT EDGE — i.e.
            half the card — so the width the -50% pulls back by is whatever the
            content happened to resolve to. Text-only headings got away with it
            (text-nowrap forced the natural width back); an icon or a bigger font
            tips it off centre. Pinning both edges spans the card's box outright,
            so `text-center` centres on the CARD, not on the heading's own width —
            true at any font size.
            px-10 keeps it clear of the rounded corners and the ✕. text-nowrap
            keeps it on one line: it straddles the card's top edge, so a second
            line would grow DOWN into the panel's padding rather than push the
            layout — one long line running wide is the better failure.
            The stroke is font-display's, so it's already on; --stroke-color only
            names the ink, matching `title` below. It earns its keep here more
            than anywhere: the heading overhangs the card, so it crosses the
            bevel onto the dim backdrop, and the outline is what keeps the
            letters legible over both — hence a heavier width than the 0.125em
            default. px, not em, because this h2's size is hard-coded too, so
            there's nothing for an em to scale against; 6px matches the Footer
            labels. Remember only HALF a centred stroke shows, so 6px reads as a
            3px outline. Much past this and Lilita One's counters (the holes in
            'R', 'O') start silting up. */}
        {heading && (
          <h2 className="absolute inset-x-0 -top-[15px] px-10 text-center font-display text-3xl tracking-[0.5px] text-white [--stroke-color:#1B4E86] [--stroke-width:8px] drop-shadow-[0_5px_5px_rgba(0,0,0,0.35)] text-nowrap">
            {heading}
          </h2>
        )}
        <span className='mb-5' />

        {title && (
          <h2 className="mb-5 text-center font-display text-3xl tracking-[0.5px] text-white [--stroke-color:#1B4E86] drop-shadow-[0_5px_5px_rgba(0,0,0,0.35)]">
            {title}
          </h2>
        )}


        {children}
      </Card>
    </div>,
    document.body,
  )
}
