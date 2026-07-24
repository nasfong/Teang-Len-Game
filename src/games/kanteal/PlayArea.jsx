import PlayingCard from '../../components/PlayingCard/PlayingCard.jsx'

// One seat's played cards, laid out in front of them and never cleared.
//
// This is the whole point of Kanteal's table: at a real game you place your card
// down in front of you and it STAYS there — beaten or not, cycle after cycle — so
// anyone can read back what everyone has played. There is no central discard pile
// to sweep it into. The felt's centre is left for the §7 challenge alone.
//
// Face-down entries are drawn as backs and carry no card at all (see `played` in
// match.js): a §3 pass is hidden from everyone, so the identity never reaches the
// client in the first place. What the table gets to see is that you discarded, and
// in what order — exactly what it would see across a real table.

// Two tiers. The normal table (≤4 seats) uses the 48px `sm` card so a played card
// reads clearly in front of its owner — the slots are far apart there, so there's
// room. A seat plays at most six, so a row is 48 + 5×STEP wide.
//
// `dense` exists because the play ring gets crowded: at 6 and 8 seats the adjacent
// slots are only ~92–95px apart, so dense keeps the small 32px `xs` card and the
// tight 9px step (row = 32 + 5×9 = 77px) to clear the neighbours by 15px+. (Measured,
// not guessed: the slot spacing comes straight from Table's PLAY_RING.)
const CARD_W = 48
const STEP = 20
const CARD_W_DENSE = 32
const STEP_DENSE = 9

/**
 * @param played  the seat's history, oldest first: [{ card } | { hidden: true }]
 * @param currentId  id of the card currently holding the table, if this seat owns
 *                   it — drawn with the gold edge so "what you must beat" is still
 *                   obvious once the centre pile is gone
 * @param label   optional caption under the row (the seat's name)
 * @param dense   tighter overlap for crowded tables (5+ seats) — see STEP_DENSE
 */
export default function PlayArea({ played = [], currentId = null, label = null, dense = false }) {
  if (!played.length) return null
  const step = dense ? STEP_DENSE : STEP
  const cardW = dense ? CARD_W_DENSE : CARD_W

  return (
    <div className="pointer-events-none flex flex-col items-center gap-0.5">
      <div className="flex items-end">
        {played.map((entry, i) => (
          <span
            key={i}
            className="block"
            style={{ marginLeft: i === 0 ? 0 : `${step - cardW}px` }}
          >
            <PlayingCard
              size={dense ? 'xs' : 'sm'}
              faceDown={Boolean(entry.hidden)}
              rank={entry.card?.rank}
              suit={entry.card?.suit}
              // The live card sits proud of its own history so it reads as active
              // rather than as just the newest thing in the row.
              className={entry.card && entry.card.id === currentId ? '-translate-y-1.5' : ''}
              selected={Boolean(entry.card && entry.card.id === currentId)}
            />
          </span>
        ))}
      </div>
      {label && !dense && (
        <span className="font-display text-[9px] leading-none text-white/55 [--stroke-width:0] [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {label}
        </span>
      )}
    </div>
  )
}
