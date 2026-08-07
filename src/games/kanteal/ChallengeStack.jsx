import PlayingCard from '../../components/PlayingCard/PlayingCard.jsx'

// The committed pair in Kanteal's final challenge (two-card commit). The face-up
// Round-1 card sits on top, fully readable; the held face-down Round-2 card sits
// BEHIND it, offset down so only its bottom ~20% peeks out — a pure "there's a second,
// hidden card here" cue that carries no rank/suit (it's a card back). Once the round-2
// reveal has happened the held card is known, so pass `down` to flip the back up.
//
// Geometry: the back is translated down by 20% of a card height, so 80% hides behind
// the top card and the bottom 20% shows. While it's still held it sits BEHIND the
// face-up card (-z), a mystery peek. On the Round-2 reveal (`down` set) it flips face-up
// and comes to the FRONT (z-10) — the last card played lands on top of the first.
export default function ChallengeStack({ up, down = null, size = 'sm', className = '' }) {
  const revealed = Boolean(down)
  return (
    <div className={`relative inline-block ${className}`}>
      <div aria-hidden={!revealed} className={`absolute inset-x-0 top-0 translate-y-[40%] ${revealed ? 'z-10' : '-z-10'}`}>
        <PlayingCard rank={down?.rank} suit={down?.suit} faceDown={!down} size={size} />
      </div>
      <PlayingCard rank={up?.rank} suit={up?.suit} faceDown={!up} size={size} />
    </div>
  )
}
