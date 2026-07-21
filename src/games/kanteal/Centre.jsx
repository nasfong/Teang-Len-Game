import PlayingCard from '../../components/PlayingCard/PlayingCard.jsx'
import { SUIT_MARK } from './match.js'

// The felt's centre for Kanteal — shared by the networked Board and the offline
// Demo, so the two can never drift on how a cycle is presented. Pure display: it
// reads state and renders, and decides nothing.

const cardLabel = (c) => (c ? `${c.rank}${SUIT_MARK[c.suit]}` : '')

/** The table card, the §7 challenge, and this cycle's reveals. */
export default function Centre({ gs }) {
  const { table, challenge, reveals, seats, discards } = gs
  const hidden = discards.reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col items-center gap-2">
      {/* §7 — display only. Names whoever currently holds the challenge; it changes
          nothing about legality and resets with the cycle. */}
      {challenge && (
        <span className="rounded-full border border-[#FFD27A]/60 bg-black/60 px-3 py-0.5 font-display text-xs text-[#FFD27A] [--stroke-width:0]">
          {seats[challenge.seat].name} challenged with {cardLabel(challenge.card)}
        </span>
      )}

      <div className="flex items-end gap-3">
        {table ? (
          <PlayingCard rank={table.rank} suit={table.suit} size={challenge ? 'lg' : 'md'} />
        ) : (
          <div className="flex h-22 w-16 items-center justify-center rounded-lg border-[3px] border-dashed border-white/30">
            <span className="px-1 text-center font-display text-[11px] leading-tight text-white/50 [--stroke-width:0]">
              Open the cycle
            </span>
          </div>
        )}

        {/* §5/§7 — cards played face-up that could NOT beat. They sit BESIDE the
            table card, dimmed, because they took nothing: showing them in the pile
            would imply they were in contention. */}
        {reveals.length > 0 && (
          <span aria-hidden className="flex items-end opacity-55">
            {reveals.map(({ seat, card }, i) => (
              <span key={`${card.id}-${seat}`} style={{ marginLeft: i === 0 ? 0 : -28 }}>
                <PlayingCard rank={card.rank} suit={card.suit} size="sm" />
              </span>
            ))}
          </span>
        )}
      </div>

      {/* §3 — face-down passes are a COUNT and nothing else. Never render identities. */}
      {hidden > 0 && (
        <span className="font-display text-[11px] text-white/45 [--stroke-width:0]">
          {hidden} card{hidden === 1 ? '' : 's'} discarded face-down
        </span>
      )}
    </div>
  )
}
