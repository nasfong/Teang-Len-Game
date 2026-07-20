import { useEffect, useState } from 'react'

// The game is built for LANDSCAPE — the table seats a felt across the width, and
// every screen assumes a wide viewport. Rather than maintain a second portrait
// layout, we gate it: on a phone-sized screen held in portrait, this full-screen
// overlay asks the player to rotate. A desktop in a tall window is left alone
// (the max-width keeps the gate to phone/tablet widths).
const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 900px)'

export default function LandscapeGate() {
  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PORTRAIT_QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY)
    const onChange = () => setPortrait(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (!portrait) return null

  return (
    // z above every modal/toast (those top out at z-60) so nothing pokes through
    // while the player is being asked to rotate.
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-linear-to-b from-[#2B7FC9] to-[#0F3358] px-8 text-center">
      <span className="text-7xl drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)] motion-safe:animate-[rotate-hint_2.6s_ease-in-out_infinite]">
        📱
      </span>
      <div>
        <h1 className="font-display text-3xl text-white [--stroke-color:#00376B] drop-shadow-[0_3px_5px_rgba(0,0,0,0.4)]">
          Rotate your device
        </h1>
        <p className="mt-2 font-display text-lg text-[#FFD27A] [--stroke-width:0]">
          Teang Len plays best in landscape.
        </p>
      </div>
    </div>
  )
}
