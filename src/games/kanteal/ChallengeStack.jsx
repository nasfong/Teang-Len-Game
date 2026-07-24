import PlayingCard from '../../components/PlayingCard/PlayingCard.jsx'

// The committed pair in Kanteal's final challenge (two-card commit). The face-up
// Round-1 card sits on top, fully readable; the held face-down Round-2 card sits
// BEHIND it, offset down so only its bottom ~20% peeks out — a pure "there's a second,
// hidden card here" cue that carries no rank/suit (it's a card back). Once the round-2
// reveal has happened the held card is known, so pass `down` to flip the back up.
//
// Geometry: the back is translated down by 20% of a card height, so 80% hides behind
// the top card and the bottom 20% shows; -z keeps it behind the face-up card.
export default function ChallengeStack({ up, down = null, size = 'sm', className = '' }) {
  return (
    <div className={`relative inline-block ${className}`}>
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 translate-y-[20%]">
        <PlayingCard rank={down?.rank} suit={down?.suit} faceDown={!down} size={size} />
      </div>
      <PlayingCard rank={up?.rank} suit={up?.suit} faceDown={!up} size={size} />
    </div>
  )
}
