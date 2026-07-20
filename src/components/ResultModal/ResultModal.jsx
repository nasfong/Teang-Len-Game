import Modal from '../Modal/Modal.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import Button from '../Button/Button.jsx'

// ResultModal — how a match ends: who won, the final placements, what everyone's
// coins did, and the only two ways out. Composite (Modal + Avatar + Button), so
// copying it out brings all three folders.
//
//   <ResultModal open={over} players={standings} onRematch={…} onLeave={…} />
//
// NOT DISMISSIBLE, on purpose: closable={false} kills the ✕, Escape and the
// backdrop click. A result screen is a decision — rematch or leave — not an
// overlay to wave away. Dismissing it would strand a player on a dead table.

// Medals for the podium; 4th and beyond get the plain chip.
const PLACES = {
  1: 'border-[#8A5A12] bg-linear-to-b from-[#FFE08A] to-[#FFB23E] [--stroke-color:#8A5A12]',
  2: 'border-[#5A6B78] bg-linear-to-b from-[#EDF2F6] to-[#A8B8C4] [--stroke-color:#5A6B78]',
  3: 'border-[#6B3F18] bg-linear-to-b from-[#E8A87C] to-[#B5713C] [--stroke-color:#6B3F18]',
}
const PLAIN_PLACE = 'border-[#00376B] bg-black/35 [--stroke-color:#00376B]'

/** @param players [{ name, avatarSrc?, place, coin, you? }] — `coin` is the
 *  DELTA for the match (+won / −lost), and `you` marks the local player. Any
 *  order; they're sorted by place here. */
export default function ResultModal({
  open = false,
  players = [],
  onRematch,
  onLeave,
  rematchLabel = 'Rematch',
  leaveLabel = 'Leave',
  busy = false,
}) {
  // Sorted here rather than demanded of the caller — the game knows placements,
  // not necessarily in podium order.
  const standings = [...players].sort((a, b) => a.place - b.place)
  const me = standings.find((p) => p.you)
  const winner = standings[0]
  const won = me?.place === 1

  return (
    <Modal open={open} closable={false} size="md">
      {won ? (
        <h2 className="mb-1 text-center font-display text-4xl tracking-[1px] text-[#FFD27A] [--stroke-color:#7A4A10] drop-shadow-[0_5px_5px_rgba(0,0,0,0.4)]">
          🏆 YOU WIN!
        </h2>
      ) : (
        <h2 className="mb-1 text-center font-display text-3xl tracking-[0.5px] text-white [--stroke-color:#1B4E86] drop-shadow-[0_5px_5px_rgba(0,0,0,0.35)]">
          {winner?.name ?? 'Nobody'} wins
        </h2>
      )}

      {/* Softens the loss without hiding it — you still see your own row below */}
      {me && !won && (
        <p className="text-center font-display text-sm text-white/70 [--stroke-width:0]">
          You finished {ordinal(me.place)}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {standings.map((p, i) => (
          <PlaceRow key={p.id ?? `${p.name}-${i}`} {...p} />
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Button variant="blue" size="sm" disabled={busy} onClick={onLeave}>
          {leaveLabel}
        </Button>
        <Button variant="green" size="sm" disabled={busy} onClick={onRematch}>
          {busy ? 'Please wait…' : rematchLabel}
        </Button>
      </div>
    </Modal>
  )
}

function PlaceRow({ name = 'Player', avatarSrc, place, coin = 0, you = false }) {
  const medal = PLACES[place] ?? PLAIN_PLACE
  const coinColor = coin > 0 ? 'text-[#9fe03a]' : coin < 0 ? 'text-[#FFB3AC]' : 'text-white/50'

  return (
    <div
      className={`flex items-center gap-3 rounded-[18px] border-2 px-3 py-2 ${
        // Your own row is picked out — in a 4-way result you shouldn't have to
        // hunt for yourself.
        you ? 'border-[#FFD27A]/60 bg-black/40' : 'border-transparent bg-black/20'
      }`}
    >
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 font-display text-xs text-white ${medal}`}>
        {place}
      </span>

      <Avatar name={name} src={avatarSrc} size="sm" />

      {/* min-w-0 or the name refuses to shrink below its text and shoves the
          coin delta out of the row */}
      <span className="min-w-0 flex-1 truncate font-display text-base text-white [text-shadow:0_2px_2px_rgba(0,0,0,0.4)]">
        {name}
      </span>

      <span className={`shrink-0 font-display text-base ${coinColor} [--stroke-width:0]`}>
        {coin > 0 ? '+' : ''}
        {coin.toLocaleString()}
      </span>
    </div>
  )
}

function ordinal(n) {
  // 11th/12th/13th are the exceptions that a plain %10 rule gets wrong.
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
