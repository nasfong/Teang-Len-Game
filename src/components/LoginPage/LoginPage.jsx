import { motion, useReducedMotion } from 'motion/react'
import AuthForm from '../AuthForm/AuthForm.jsx'

// LoginPage — the entry screen: the game wordmark over the same full-bleed
// background as HomePage, with the AuthForm (Log in / Sign up) centred on it.
//
// PRESENTATIONAL, like the other pages: it owns no auth logic. The form reports
// onSubmit({ mode, username, password }) and onModeChange, and the page passes
// them straight up — so the app's store (Zustand, Q2) and the API call (Q3) live
// ABOVE this component and drop in without touching it. `busy` locks the form's
// submit while a request is in flight.
//
// AuthForm carries its own solid Card panel, so it reads straight on the art. The
// background <img> is BLURRED (with a dark scrim) so the wordmark and form pop off
// it — the blur is on the backdrop itself, not a panel behind the card. Real <img>
// under everything (-z-10 + `isolate`, see HomePage); a house gradient stands in
// without one.

export default function LoginPage({
  background,
  brand = 'Teang Len',
  tagline = 'Game',
  defaultMode,
  busy,
  onSubmit,
  onModeChange,
  className = '',
}) {
  const reduceMotion = useReducedMotion()
  // Entrance: the wordmark drops in from the top, the form floats up just after —
  // dropped to an instant cut when the OS asks for reduced motion.
  const drop = reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }
  const rise = reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 24, delay: 0.12 }

  return (
    <div
      className={`relative isolate flex min-h-dvh w-full flex-col items-center justify-center gap-3 overflow-hidden px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] py-4 tall:gap-5 tall:py-6 ${className}`}
    >
      {/* Background is blurred so the wordmark + form read cleanly over it. blur
          softens the edges to transparent, so scale-105 over-fills to keep the
          frame covered. A faint dark scrim deepens the contrast under the form. */}
      {background ? (
        <img
          src={background}
          alt=""
          aria-hidden
          decoding="sync"
          className="absolute inset-0 -z-10 size-full scale-105 object-cover blur-md"
          draggable={false}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-[#2B7FC9] to-[#0F3358]" />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/20" />

      {/* Wordmark — sits on the bare background, so it carries its own outline +
          shadow the way the Header logo does. */}
      {brand && (
        <motion.div className="text-center" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={drop}>
          <h1 className="font-display text-4xl text-white [--stroke-color:#00376B] drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)] tall:text-5xl">
            {brand}
          </h1>
          {tagline && (
            <p className="font-display text-xl text-[#FFD27A] [--stroke-color:#7A4A10] drop-shadow-[0_3px_5px_rgba(0,0,0,0.4)] tall:text-2xl">
              {tagline}
            </p>
          )}
        </motion.div>
      )}

      <motion.div className="w-full max-w-100" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={rise}>
        <AuthForm defaultMode={defaultMode} busy={busy} onSubmit={onSubmit} onModeChange={onModeChange} />
      </motion.div>
    </div>
  )
}
