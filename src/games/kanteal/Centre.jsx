import PlayingCard from '../../components/PlayingCard/PlayingCard.jsx'
import { SUIT_MARK } from './match.js'

// The felt's centre for Kanteal — shared by the networked Board and the offline
// Demo, so the two can never drift on how a cycle is presented.
//
// It shows the §7 CHALLENGE and, when there is no challenge, the turn HINT. Both
// belong to the whole table rather than to any one seat. Kanteal has no central
// discard pile — every card played stays in front of the player who played it
// (see PlayArea.jsx), the way it would on a real table — so the middle of the felt
// is empty, which is exactly why the hint can live there.
//
// WHY THE CENTRE, for the hint: it used to be an absolutely-positioned pill in a
// corner, and no corner works. Seats sit on a computed ellipse, so at 6–8 players
// one of them laps whatever fixed spot you pick (top-centre hides the far seat's
// avatar; top-left collides with the Leave button). The centre is the one region
// no seat and no play area can reach at ANY seat count — the play areas ring it at
// rx=25/ry=24 and the centre sits inside that ring.
//
// WHY ONLY WHEN THERE IS NO CHALLENGE: the challenge is a full lg card plus a
// caption, and that stack already fills most of the vertical space between the
// play ring's top row and its bottom row. Adding a third element pushes into one
// of them whichever way it is stacked — above, it meets the far seat's play row;
// below, it meets the local player's own (the reason the caption is above the card
// in the first place). Rather than fight for the last few pixels, the hint yields
// to the challenge, and the caller falls back to the corner pill for the seconds a
// challenge is up.
//
// So a caller must render its corner pill under `gs.challenge` and NOT under
// `!hint` — the two placements are exclusive, and this file decides which. (That
// rule is inlined at both call sites rather than exported from here: a non-
// component export would cost this file its Fast Refresh.)
//
// Pure display: it reads state and decides nothing.

const cardLabel = (c) => (c ? `${c.rank}${SUIT_MARK[c.suit]}` : '')

/**
 * @param gs    Kanteal match state
 * @param hint  one line of turn guidance ('' / null renders nothing)
 */
export default function Centre({ gs, hint = null }) {
  const { challenge, seats } = gs
  const showHint = hint && !challenge
  if (!challenge && !showHint) return null

  return (
    <div className="pointer-events-none flex max-w-[62%] flex-col items-center gap-1.5">
      {showHint && (
        <span className="max-w-full truncate rounded-full border border-white/15 bg-black/55 px-4 py-1 font-display text-sm text-white/90 [--stroke-width:0] [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
          {hint}
        </span>
      )}
      {/* Caption ABOVE the card: below it, it collided with the local player's own
          play row, which sits at the bottom of the play ring under the centre. */}
      {challenge && (
        <>
          <span className="rounded-full border border-[#FFD27A]/60 bg-black/65 px-3 py-0.5 font-display text-xs text-[#FFD27A] [--stroke-width:0]">
            {seats[challenge.seat].name} challenged with {cardLabel(challenge.card)}
          </span>
          <PlayingCard rank={challenge.card.rank} suit={challenge.card.suit} size="lg" />
        </>
      )}
    </div>
  )
}
