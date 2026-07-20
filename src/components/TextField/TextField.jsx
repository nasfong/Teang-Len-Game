import { useState } from 'react'

// Game-style text input with an optional left icon (e.g. Room name field).
// Password fields (type="password") get a show/hide toggle switch on the right.
// Uncontrolled by default (works standalone); pass value + onChange to control.
// Self-contained, Tailwind-only. Uses the font-display token (Lilita One).
//
// ICON SIZING — `icon` takes any node (an emoji, an <img>, an <svg>). It sits in
// a square slot and the text's indent is COMPUTED from that slot, so the gap
// between them is constant and they can't overlap however big the art is:
//
//   <TextField icon="🔒" />                                    22px slot
//   <TextField className="[--icon-slot:40px]" icon={<img …/>} />
//
// An <img> is stretched to fill the slot, so don't size it at the call site —
// the slot is the single source of truth for the geometry.
//
// The default lives in the var()'s FALLBACK, not in a class on the wrapper: a
// default class would collide with the caller's on the same element, and Tailwind
// picks the winner by stylesheet order rather than by who asked last.

// Chrome/Safari repaint autofilled inputs with their own pale background and dark
// text, which blows up the game styling. That background can't be overridden
// directly — the working trick is a huge inset box-shadow painted over it, plus
// -webkit-text-fill-color for the text (plain `color` is ignored while autofilled).
// The 9999s transition parks the browser's background fade so it never lands.
// Override the fill per context with [--autofill-bg:#xxx].
const AUTOFILL = [
  '[--autofill-bg:#2A6296]',
  '[&:-webkit-autofill]:[-webkit-text-fill-color:#fff]',
  '[&:-webkit-autofill]:[caret-color:#9fe03a]',
  '[&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]',
  '[&:-webkit-autofill]:[box-shadow:inset_0_3px_6px_rgba(0,0,0,0.35),inset_0_0_0_1000px_var(--autofill-bg)]',
  '[&:-webkit-autofill:hover]:[box-shadow:inset_0_3px_6px_rgba(0,0,0,0.35),inset_0_0_0_1000px_var(--autofill-bg)]',
  // keep the lime focus glow while autofilled
  '[&:-webkit-autofill:focus]:[box-shadow:inset_0_3px_6px_rgba(0,0,0,0.35),inset_0_0_0_1000px_var(--autofill-bg),0_0_0_3px_rgba(159,224,58,0.35)]',
].join(' ')

const INPUT = [
  // Compact on short (landscape-phone) viewports; full height on roomier screens.
  'w-full rounded-[18px] border-[3px] border-[#1B4E86] bg-black/25 py-2 tall:py-3',
  'font-display text-base text-white placeholder:text-white tall:text-lg',
  // sunken groove, so the field reads as carved into the panel
  'shadow-[inset_0_3px_6px_rgba(0,0,0,0.35)]',
  'caret-[#9fe03a] selection:bg-[#9fe03a]/30',
  'outline-none transition-[border-color,box-shadow] duration-150',
  // focus (click OR keyboard): lime edge + soft lime glow
  'focus:border-[#9fe03a] focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.35),0_0_0_3px_rgba(159,224,58,0.35)]',
  AUTOFILL,
].join(' ')

// `ref` is taken explicitly (React 19 passes it as a prop) so form libraries
// like react-hook-form can register the input via {...register('field')}.
export default function TextField({ icon, type = 'text', className = '', ref, ...props }) {
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)
  const inputType = isPassword && revealed ? 'text' : type

  return (
    <div className={`relative ${className}`}>
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 flex size-[var(--icon-slot,22px)] -translate-y-1/2 items-center justify-center text-lg [&>img]:size-full [&>img]:object-contain">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        type={inputType}
        className={`${INPUT} ${
          // left-3.5 (14px) in front of the icon + the slot + 6px after it.
          // Derived from the slot, so the gap holds at any icon size instead of
          // being tuned to one — bump the 20 to move the text off the art.
          icon ? 'ps-[calc(var(--icon-slot,22px)+20px)]' : 'pl-4'
        } ${isPassword ? 'pr-16' : 'pr-4'}`}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          role="switch"
          aria-checked={revealed}
          aria-label="Show password"
          onClick={() => setRevealed((v) => !v)}
          className={`absolute top-1/2 right-3 flex h-6 w-11 -translate-y-1/2 items-center rounded-full border-2 border-[#1B4E86] px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9fe03a] ${
            revealed ? 'bg-[#9fe03a]' : 'bg-black/30'
          }`}
        >
          <span
            className={`size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-transform ${
              revealed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      )}
    </div>
  )
}
