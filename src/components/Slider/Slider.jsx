import { useState } from 'react'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// Labeled range slider with a live value readout (e.g. Bet Amount field).
// Self-contained + stateful: seeds from `defaultValue` and reports changes via
// `onChange(value)`. Tailwind-only; uses the font-display token (Lilita One).

// Color is applied per element so it never collides with this base.
const OUTLINE = 'font-display [--stroke-color:#1B4E86]'

// Custom range styling: a sunken groove with a lime fill and a chunky knob.
// WebKit fills the track via the inline gradient below (it has no ::progress);
// Firefox uses ::-moz-range-progress. Thumb classes are written out per browser
// (Tailwind can't read interpolation), so the two blocks mirror each other.
const RANGE = [
  'h-3 flex-1 cursor-pointer appearance-none rounded-full bg-black/30',
  // sunken groove so the fill reads as sitting inside the track
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)]',
  '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full',
  '[&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#2f5e0d] [&::-webkit-slider-thumb]:bg-[linear-gradient(180deg,#c2f051_0%,#9fe03a_55%,#7cc42a_100%)] [&::-webkit-slider-thumb]:shadow-[0_2px_4px_rgba(0,0,0,0.45),inset_0_2px_0_rgba(255,255,255,0.5)] [&::-webkit-slider-thumb]:transition-transform',
  'hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95',
  '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-black/30',
  '[&::-moz-range-progress]:h-3 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-[linear-gradient(90deg,#c2f051_0%,#7cc42a_100%)]',
  '[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#2f5e0d] [&::-moz-range-thumb]:bg-[#9fe03a] [&::-moz-range-thumb]:shadow-[0_2px_4px_rgba(0,0,0,0.45)]',
].join(' ')

export default function Slider({
  label,
  icon = <CoinIcon />,
  min = 1000,
  max = 50000,
  step = 1000,
  defaultValue = 5000,
  suffix = 'Coins',
  format = (v) => v.toLocaleString(),
  onChange,
}) {
  const [value, setValue] = useState(defaultValue)
  const pct = ((value - min) / (max - min)) * 100

  function handleChange(e) {
    const next = Number(e.target.value)
    setValue(next)
    onChange?.(next)
  }

  return (
    <div className="flex items-center gap-3.5">
      {label && <div className={`shrink-0 whitespace-nowrap text-lg text-white ${OUTLINE}`}>{label}</div>}
      {icon && <span className="text-lg">{icon}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className={RANGE}
        // WebKit paints the element background as the track — fill it up to pct.
        style={{
          background: `linear-gradient(90deg, #c2f051 0%, #7cc42a ${pct}%, rgba(0,0,0,0.30) ${pct}%)`,
        }}
      />
      {/* coin gold (#FFD27A) — matches the CoinIcon and the coin text in Header /
          RoomCard / the form's balance line. The track stays lime; only the
          amount reads as currency. */}
      <span className={`min-w-23 whitespace-nowrap text-right text-[15px] text-[#FFD27A] ${OUTLINE}`}>
        {format(value)} {suffix}
      </span>
    </div>
  )
}
