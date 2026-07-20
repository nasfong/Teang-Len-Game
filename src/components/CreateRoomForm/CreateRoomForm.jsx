import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import Button from '../Button/Button.jsx'
import TextField from '../TextField/TextField.jsx'
import Slider from '../Slider/Slider.jsx'
import SquareToggle from '../SquareToggle/SquareToggle.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'
import HintBubble from '../HintBubble/HintBubble.jsx'
// Co-located, not in a shared src/assets/ — a component that reaches outside its
// own folder can't be copied out, which is the whole point of this workbench.
import pencilIcon from './pencal.webp'

// Create Room form — a COMPOSITE built from our components (Button, TextField,
// Slider, SquareToggle, HintBubble). Imports its siblings, so copying it out means
// bringing those folders too.
//
// Validation is react-hook-form + yup (same shape as AuthForm's RHF setup), with
// messages surfaced as HintBubble speech bubbles off each field. The bet slider and
// the max-players toggles aren't native inputs, so they're driven with setValue /
// watch rather than register. Reports out via onSubmit(values) / onCancel; pass
// `balance` for the affordability hint + submit guard, `defaultName` to seed the
// room name (the lobby seeds it with the player's own name).

const OUTLINE = 'font-display [--stroke-color:#1B4E86]'
const PLAYER_OPTIONS = [2, 3, 4]

// Mirrors the backend createRoomSchema (name 1–24; bet is a positive Slider step).
const schema = yup.object({
  roomName: yup.string().trim().required('Name your room').max(24, 'Keep it under 24 characters'),
  betAmount: yup.number().required().integer().min(1000),
  maxPlayers: yup.number().oneOf(PLAYER_OPTIONS).required(),
})

export default function CreateRoomForm({
  submitLabel = 'Create',
  cancelLabel = 'Cancel',
  creating = false,
  balance,
  defaultName = '',
  onSubmit,
  onCancel,
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    mode: 'onTouched',
    resolver: yupResolver(schema),
    defaultValues: { roomName: defaultName, betAmount: 5000, maxPlayers: 4 },
  })

  const betAmount = watch('betAmount')
  const maxPlayers = watch('maxPlayers')

  const showBalance = balance != null
  const unaffordable = showBalance && betAmount > balance

  const submit = handleSubmit((v) => {
    if (unaffordable) return
    onSubmit?.({ roomName: v.roomName.trim(), betAmount: v.betAmount, maxPlayers: v.maxPlayers })
  })

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-115">
      {/* Room name — the field anchors the bubble (`relative`), which floats out to
          the right rather than pushing the slider down. */}
      <div className="relative mb-5">
        <TextField
          icon={<img src={pencilIcon} alt="" />}
          placeholder="Room name"
          maxLength={24}
          className="[--icon-slot:26px]"
          {...register('roomName')}
        />
        {errors.roomName && <HintBubble>{errors.roomName.message}</HintBubble>}
      </div>

      {/* Bet amount — uncontrolled Slider, reported into the form on change. */}
      <div className="mb-2">
        <Slider
          label="Bet Amount"
          defaultValue={betAmount}
          onChange={(v) => setValue('betAmount', v, { shouldValidate: true, shouldDirty: true })}
        />
      </div>

      {/* Live balance + affordability hint */}
      {showBalance && (
        <p className={`mb-5 text-right text-[13px] ${OUTLINE} ${unaffordable ? 'text-[#FFB3AC]' : 'text-white/85'}`}>
          {unaffordable ? 'Not enough coins' : 'Balance'}: <CoinIcon /> {balance.toLocaleString()}
        </p>
      )}

      {/* Max players */}
      <div className="mb-7 flex items-center gap-3.5">
        <span className={`text-lg text-white ${OUTLINE}`}>Max Players</span>
        <div className="flex gap-2">
          {PLAYER_OPTIONS.map((n) => (
            <SquareToggle key={n} active={maxPlayers === n} onClick={() => setValue('maxPlayers', n, { shouldDirty: true })}>
              {n}
            </SquareToggle>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Button type="button" variant="blue" disabled={creating} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant="green" disabled={creating || unaffordable}>
          {creating ? 'Creating…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
