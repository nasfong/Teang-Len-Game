import PlayingCard from '../PlayingCard/PlayingCard.jsx'

// TrickPile — what's on the table: the combo currently winning the trick, with
// the play it just beat peeking out from behind it. Composite (wraps
// PlayingCard), so copying it out brings that folder too. Goes in Table's centre
// slot.
//
//   <Table players={…}><TrickPile cards={trick} pile={played} /></Table>
//
// Stateless and config-driven: `cards` is the live combo (1 card, a pair, a
// straight, a bomb — Teang Len allows all of them, so nothing here assumes a
// count), `pile` is everything played before it — but only the most recent play
// (the one this combo topped) is drawn.

// Card widths duplicated from PlayingCard's SIZES — spacing is computed in JS,
// so keep them in step if you retune the card. `step` is deliberately wider than
// Hand's: a played combo has to be READ, not just held.
const SIZES = {
  sm: { w: 48, step: 30, box: 'h-17 w-12' },
  md: { w: 64, step: 40, box: 'h-22 w-16' },
  lg: { w: 80, step: 50, box: 'h-28 w-20' },
}

// Deterministic scatter — the same card always lands at the same angle.
// Math.random() here would re-roll on every parent re-render, so the whole table
// would twitch each time you hovered a card in your hand.
function jitter(seed, range) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return (((Math.abs(h) % 200) / 200) * 2 - 1) * range
}

const cardId = (card, i) => card.id ?? `${card.rank}-${card.suit}-${i}`

// Where a freshly played combo flies IN from — toward its player's seat, so it
// reads as coming off their hand. The values are the start offset the drop-in
// keyframe animates away to zero; big enough to travel a clear distance, not so
// big it starts off-table. `from` is the seat's screen edge (see Table's layout).
const DROP_FROM = {
  bottom: { '--drop-x': '0px', '--drop-y': '150px' }, // your hand, along the front rim
  top: { '--drop-x': '0px', '--drop-y': '-120px' },
  left: { '--drop-x': '-220px', '--drop-y': '0px' },
  right: { '--drop-x': '220px', '--drop-y': '0px' },
}

/**
 * @param cards     the combo currently winning the trick
 * @param pile      earlier plays; only the last (the one this combo beat) shows,
 *                  peeking out behind the live cards
 * @param size      'sm' | 'md' | 'lg'  (default 'md')
 * @param from      which seat the live combo was played from — 'bottom' | 'top' |
 *                  'left' | 'right'. The cards fly in from that edge. (default
 *                  'bottom'). Re-keys nothing: new cards remount and animate once.
 */
export default function TrickPile({
  cards = [],
  pile = [],
  size = 'md',
  from = 'bottom',
  emptyText = 'Lead any card',
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md
  // Just the play this combo beat — the top of the pile. The old scatter of eight
  // dead cards was clutter you couldn't read anyway; one card peeking out behind
  // the combo shows what was topped without competing with it.
  const beaten = cards.length > 0 ? pile.slice(-1) : []

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* The play this combo beat — peeks up from behind the live cards, dimmed
            and static, so you can read what was topped. It sits behind because
            it's earlier in the DOM than the combo below and both are auto z-index.
            Centred over the combo via an inset-0 layer; items-start + a nudge up
            leaves just its top edge showing above the live cards. */}
        {beaten.length > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center">
            <span className="opacity-45 [transform:translateY(-42%)]">
              <PlayingCard rank={beaten[0].rank} suit={beaten[0].suit} size={size} />
            </span>
          </div>
        )}

        {cards.length === 0 ? (
          // The empty slot doubles as the container's height — without it the row
          // would collapse and the table centre would jump when the first card lands.
          <div
            className={`flex ${s.box} items-center justify-center rounded-lg border-[3px] border-dashed border-white/30`}
          >
            <span className="px-1 text-center font-display text-[11px] leading-tight text-white/50 [--stroke-width:0]">
              {emptyText}
            </span>
          </div>
        ) : (
          <div className="relative flex items-center">
            {cards.map((card, i) => {
              const id = cardId(card, i)
              return (
                // Outer layer flies the card in from its player's seat. The flight
                // is translate+scale only; the jitter rotation is on the inner
                // span, so the drop-in's `forwards` fill can't freeze the rotation
                // out. A small per-card delay lands a combo card-by-card.
                <span
                  key={id}
                  className="animate-drop-in"
                  style={{
                    ...(DROP_FROM[from] ?? DROP_FROM.bottom),
                    animationDelay: `${i * 70}ms`,
                    marginLeft: i === 0 ? 0 : `${s.step - s.w}px`,
                  }}
                >
                  <span
                    className="block transform-[rotate(var(--rot))]"
                    style={{
                      // A live combo only wobbles a little — enough to look dealt
                      // rather than printed, not so much it's hard to read.
                      '--rot': `${jitter(`${id}t`, 5)}deg`,
                    }}
                  >
                    <PlayingCard rank={card.rank} suit={card.suit} size={size} />
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
