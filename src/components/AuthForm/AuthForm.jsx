import { useRef, useState, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import TextField from '../TextField/TextField.jsx'
import HintBubble from '../HintBubble/HintBubble.jsx'
// Co-located, not in a shared src/assets/ — a component that reaches outside its
// own folder can't be copied out, which is the whole point of this workbench.
import userIcon from './icon_user.webp'
import lockIcon from './key.webp'
import boyGirl from './boy-girl.webp'

// Auth form — switches between Log in / Sign up. Sign up adds a confirm-password
// field that must match. Validation is react-hook-form + zod; messages surface as
// speech bubbles under each field, validated on blur so they pop in as you go.
//
// COMPOSITE: Card shell + Button + TextField + HintBubble, so copying it out
// brings those folders too. Reports via onSubmit({ mode, username, password })
// and onModeChange(mode).
//
// This is also the one component that pulls in `motion` (npm i motion) — the
// confirm field reveals/collapses on mode switch instead of hard-popping. It
// already leans on react-hook-form + zod, so it's the heaviest composite; the
// rest of the workbench stays library-free. `useReducedMotion` drops the
// animation to an instant cut when the OS asks, matching index.css's
// prefers-reduced-motion block.

const loginSchema = z.object({
  username: z.string().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
})

const registerSchema = z
  .object({
    username: z.string().min(3, 'At least 3 characters'),
    password: z.string().min(6, 'At least 6 characters'),
    confirm: z.string().min(1, 'Repeat your password'),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Passwords don’t match',
  })

const COPY = {
  login: { title: 'LOG IN', submit: 'Log In', switchText: 'New here?', switchCta: 'Sign up' },
  register: { title: 'SIGN UP', submit: 'Sign Up', switchText: 'Have an account?', switchCta: 'Log in' },
}

export default function AuthForm({ defaultMode = 'login', busy = false, onSubmit, onModeChange }) {
  const [mode, setMode] = useState(defaultMode)
  const isRegister = mode === 'register'
  const copy = COPY[mode] ?? COPY.login
  const reduceMotion = useReducedMotion()

  // The confirm field collapses with `overflow: hidden` so its box can shrink to
  // zero height cleanly — but that also clips sideways, and HintBubble floats out
  // to the RIGHT. So overflow is only clamped WHILE the height animates; once the
  // reveal settles we let it back to visible, or a "Passwords don't match" bubble
  // would be cut off at the field's edge. (overflow can't be clipped on one axis
  // only — hiding Y forces X to compute to auto too — hence the timed release.)
  const [confirmClip, setConfirmClip] = useState(true)

  // useForm captures its options once, so the resolver reads the schema from a
  // ref — that way switching mode swaps the rules without remounting the form.
  const schema = useMemo(() => (isRegister ? registerSchema : loginSchema), [isRegister])
  const schemaRef = useRef(schema)
  schemaRef.current = schema

  // formState is a Proxy — destructuring is what subscribes to each field, so
  // touchedFields has to be pulled out here to be tracked.
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, touchedFields },
  } = useForm({
    mode: 'onTouched',
    resolver: (values, context, options) => zodResolver(schemaRef.current)(values, context, options),
  })

  // Green light on the username — reward picking a good one instead of only ever
  // scolding a bad one. Register only: "that name is free" is meaningless (and
  // backwards) when you're logging in with a name that SHOULD already exist.
  // Touched + no error is the signal: mode 'onTouched' validates on first blur,
  // then live on every keystroke, so it lands the moment the name becomes valid.
  const usernameOk = isRegister && touchedFields.username && !errors.username

  function switchMode() {
    const next = isRegister ? 'login' : 'register'
    setMode(next)
    reset() // clear values + any bubbles from the previous mode
    onModeChange?.(next)
  }

  const submit = handleSubmit(({ username, password }) => {
    onSubmit?.({ mode, username: username.trim(), password })
  })

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-100">
      <Card className="w-full flex-col p-4 tall:p-6" deco>
        <h2 className="mb-4 text-center font-display text-2xl tracking-[0.5px] text-white [--stroke-color:#1B4E86] drop-shadow-[0_5px_5px_rgba(0,0,0,0.35)] tall:mb-6 tall:text-3xl">
          🎮 {copy.title}
        </h2>

        {/* Each field is the bubble's anchor: `relative` so the bubble pins to it,
            and the bubble floats out to the right rather than pushing the next
            field down — the form never reflows as messages come and go. */}

        {/* Username */}
        <div className="relative mb-3 tall:mb-4">
          <TextField
            // The slot sizes the art — see TextField. All three fields share one
            // slot value so their placeholders line up down the form.
            className="[--icon-slot:30px]"
            icon={<img src={userIcon} alt="" />}
            placeholder="Username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            {...register('username')}
          />
          {errors.username ? (
            <HintBubble>{errors.username.message}</HintBubble>
          ) : usernameOk ? (
            // NOTE: this claims the name is AVAILABLE, but the form only checks
            // its format — there's no lookup behind it. Wire one up (or soften
            // the copy) before this goes near real players.
            <HintBubble variant="success">Nice — that name is free!</HintBubble>
          ) : null}
        </div>

        {/* Password */}
        <div className="relative mb-3 tall:mb-4">
          <TextField
            className="[--icon-slot:26px]"
            icon={<img src={lockIcon} alt="" />}
            type="password"
            placeholder="Password"
            {...register('password')}
          />
          {errors.password && <HintBubble>{errors.password.message}</HintBubble>}
        </div>

        {/* Confirm password — sign up only. AnimatePresence keeps it mounted long
            enough to play an exit when you switch back to Log in; initial={false}
            skips the reveal on first paint so a form that opens in register mode
            doesn't animate on load. Height animates from 0 → auto (and the button
            below slides up with it), so the mb-4 lives INSIDE the animated box to
            collapse along with it. */}
        <AnimatePresence initial={false}>
          {isRegister && (
            <motion.div
              key="confirm"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.34, 1.4, 0.64, 1] }}
              onAnimationStart={() => setConfirmClip(true)}
              onAnimationComplete={(def) => setConfirmClip(def.height !== 'auto')}
              style={{ overflow: confirmClip ? 'hidden' : 'visible' }}
            >
              <div className="relative mb-3 tall:mb-4">
                <TextField
                  className="[--icon-slot:26px]"
                  icon={<img src={lockIcon} alt="" />}
                  type="password"
                  placeholder="Confirm password"
                  {...register('confirm')}
                />
                {errors.confirm && <HintBubble>{errors.confirm.message}</HintBubble>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-2 flex justify-center tall:mt-3">
          <Button type="submit" variant="green" disabled={busy}>
            {busy ? 'Please wait…' : copy.submit}
          </Button>
        </div>

        {/* Switch between login / register */}
        <p className="mt-3 text-center font-display text-sm text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] tall:mt-5">
          {copy.switchText}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="text-[#FFD27A] underline underline-offset-2 hover:brightness-110 focus:outline-none"
          >
            {copy.switchCta}
          </button>
        </p>

        {/* Decorative mascot peeking off the card's bottom-right corner. Absolute
            so it doesn't push the form's layout; pointer-events-none + aria-hidden
            so it never blocks the switch link and stays out of the a11y tree. */}
        <img
          src={boyGirl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-3 -bottom-0 w-24 drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)] tall:w-32"
        />
      </Card>
    </form>
  )
}
