import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// RoomCard — a lobby listing: room name, stake, player count, seat row, Join.
// Composite (Card shell + Button), so copying it out brings both folders too.
// Style + props only — the original's store/socket/RoomSnapshot are stripped;
// `players` is just an array of { name?, avatarSrc? }. Uses font-display.
//
// SIZING: the card has no width of its own — it fills whatever cell the list
// gives it, so every card in the loop matches without being hand-sized:
//
//   <div className="grid grid-cols-2 gap-4">
//     {rooms.map(r => <RoomCard key={r.roomId} {...r} />)}
//   </div>
//
// Grid rows stretch by default, so cards in a row also share a height for free.

// One open seat — the first one shows a "+", the rest are blank. Sized to match
// Avatar's `sm` so the row of taken and open seats lines up.
function SeatEmpty({ plus = false }) {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border-[3px] border-[#00376B] bg-[rgba(20,60,110,0.45)] shadow-[inset_0_3px_6px_rgba(0,0,0,0.35)]">
      {plus && <span className="font-display text-2xl leading-none text-white [text-shadow:0_2px_2px_rgba(0,0,0,0.4)]">+</span>}
    </div>
  )
}

// Each stat is a pill pressed INTO the card — the same recessed groove the empty
// seats and the Header's coin/name bars use (dark fill + inset top shadow), so
// the numbers read as carved into the panel rather than floating on it. That
// inset is what gives the flat text a cartoon-game weight.
// leading-none so the pill hugs the text and stays a tidy capsule at this size.
const STAT = [
  'inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1',
  'font-display text-[15px] leading-none',
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)]',
  '[text-shadow:0_1px_2px_rgba(0,0,0,0.4)]',
].join(' ')

export default function RoomCard({
  name = 'Room',
  game = null, // which card game, already resolved to a display name by the caller
  betCoin = 0,
  maxPlayers = 4,
  players = [],
  status = 'waiting',
  busy = false,
  joining = false,
  onJoin,
  className = '',
}) {
  const filled = players.length
  const full = filled >= maxPlayers
  const playing = status === 'playing'
  // A full room isn't closed anymore — you enter as a spectator. A room with a seat
  // is Join (mid-game you play the next hand). So the ONLY thing that says "Watch"
  // is fullness; everything else is "Join".
  const label = joining ? 'Joining…' : full ? 'Watch' : 'Join'

  // maxPlayers seats: occupied → avatar, first open → "+", rest → blank.
  const seats = Array.from({ length: maxPlayers }, (_, i) =>
    i < filled ? (
      <Avatar key={i} name={players[i].name} src={players[i].avatarSrc} size="sm" />
    ) : (
      <SeatEmpty key={i} plus={i === filled && !full} />
    ),
  )

  return (
    <Card className={`w-full flex-col items-center gap-3 px-4 pt-3.5 pb-4 ${className}`}>
      {/* Title + a live "Playing" badge so the lobby distinguishes in-progress
          rooms (still joinable — next hand or as a spectator) from open ones. */}
      <div className="flex max-w-full items-center gap-2">
        <span className="truncate text-center font-display text-[19px] tracking-[0.3px] text-white [--stroke-color:#1B4E86] [text-shadow:0_3px_3px_rgba(0,0,0,0.3)]">
          {name}
        </span>
        {playing && (
          <span className="shrink-0 rounded-full bg-[#7CE04A]/20 px-2 py-0.5 font-display text-[11px] text-[#7CE04A] [--stroke-width:0]">
            ● Playing
          </span>
        )}
      </div>

      {/* Stake + player count — two recessed pills. The seat count goes amber
          when the room is one-from-full and red when full, so a glance down a
          lobby list picks out the rooms worth joining. */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {/* Which game. Only rendered when the caller names one, so a single-game
            lobby looks exactly as it did before. */}
        {game && <span className={`${STAT} text-[#9FE0FF]`}>{game}</span>}
        <span className={`${STAT} text-[#FFD27A]`}><CoinIcon /> {betCoin.toLocaleString()}</span>
        <span className={`${STAT} ${full ? 'text-[#FF9B8A]' : filled === maxPlayers - 1 ? 'text-[#FFD27A]' : 'text-white'}`}>
          <span aria-hidden className="text-[13px] leading-none">👤</span> {filled}/{maxPlayers}
        </span>
      </div>

      {/* Seat row — wraps, since the card no longer sets its own width: a narrow
          cell or a high maxPlayers would otherwise push the seats out of it. */}
      <div className="flex flex-wrap justify-center gap-2">{seats}</div>

      {/* Join — mt-auto pins it to the bottom, so when the grid stretches cards to
          a shared row height the buttons still line up across the row. */}
      <Button
        variant={full ? 'blue' : 'green'}
        size="sm"
        disabled={busy}
        onClick={() => onJoin?.()}
        className="mt-auto"
      >
        {full ? `👁 ${label}` : label}
      </Button>
    </Card>
  )
}
