import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// RoomCard — a lobby listing: room name, stake, player count, who's seated, Join.
// Composite (Card shell + Button + Avatar), so copying it out brings those folders.
// Style + props only — the original's store/socket/RoomSnapshot are stripped;
// `players` is just an array of { name?, avatarSrc? }. Uses font-display.
//
// MOBILE-FIRST, HORIZONTAL: the game is played in phone landscape (short viewport),
// so a lobby of tall stacked cards showed one or two rooms per screen. This is a
// compact ROW instead — name + meta on the left, seats + Join on the right — so it
// stands ~a third as tall and several rooms fit at once. It still fills whatever
// cell the grid hands it (no width of its own), and reads fine one-per-row or in a
// 2–3 column grid on a desktop:
//
//   <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
//     {rooms.map(r => <RoomCard key={r.roomId} {...r} />)}
//   </div>

// How many seated players to show as avatars before collapsing the rest into a
// "+N" chip. Kanteal seats up to 8, and eight 32px avatars would blow the row's
// width on a phone — four plus a count reads the room just as well.
const MAX_AVATARS = 4

// Each stat is a pill pressed INTO the card — the same recessed groove the Header's
// coin/name bars use (dark fill + inset top shadow), so the numbers read as carved
// into the panel rather than floating on it. leading-none keeps it a tidy capsule.
const STAT = [
  'inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-0.5',
  'font-display text-[13px] leading-none',
  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)]',
  '[text-shadow:0_1px_2px_rgba(0,0,0,0.4)]',
].join(' ')

// A ring the colour of the card surface, so overlapping avatars read as separate
// discs instead of a navy smear where their borders meet.
const SEAT_RING = 'ring-2 ring-[#2f6fb0]'

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

  const shownPlayers = players.slice(0, MAX_AVATARS)
  const overflow = filled - shownPlayers.length

  return (
    <Card className={`w-full flex-row items-center gap-2.5 px-3 py-2.5 ${className}`}>
      {/* Name + meta take the slack (min-w-0 so the long name truncates instead of
          shoving the seats and button off the row). */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-display text-[15px] leading-tight tracking-[0.3px] text-white [--stroke-color:#1B4E86] [text-shadow:0_2px_2px_rgba(0,0,0,0.3)]">
            {name}
          </span>
          {playing && (
            <span className="shrink-0 rounded-full bg-[#7CE04A]/20 px-2 py-0.5 font-display text-[10px] leading-none text-[#7CE04A] [--stroke-width:0]">
              ● Playing
            </span>
          )}
        </div>

        {/* Stake + player count as recessed pills. The seat count goes amber when
            the room is one-from-full and red when full, so a glance down the lobby
            picks out the rooms worth joining. `game` renders only when the caller
            names one, so a single-game lobby looks exactly as it did before. */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {game && <span className={`${STAT} max-w-full truncate text-[#9FE0FF]`}>{game}</span>}
          <span className={`${STAT} text-[#FFD27A]`}>
            <CoinIcon /> {betCoin.toLocaleString()}
          </span>
          <span className={`${STAT} ${full ? 'text-[#FF9B8A]' : filled === maxPlayers - 1 ? 'text-[#FFD27A]' : 'text-white'}`}>
            <span aria-hidden className="text-[12px] leading-none">👤</span> {filled}/{maxPlayers}
          </span>
        </div>
      </div>

      {/* Who's seated — overlapping mini-avatars, capped with a "+N" chip. Empty
          seats aren't drawn (the count pill already says how many are open), which
          is what lets the row stay short. Hidden entirely for an empty room. */}
      {filled > 0 && (
        <div className="flex shrink-0 -space-x-2">
          {/* {shownPlayers.map((p, i) => (
            <Avatar key={i} name={p.name} src={p.avatarSrc} size="xs" className={SEAT_RING} />
          ))} */}
          {overflow > 0 && (
            <div className={`flex size-8 items-center justify-center rounded-[10px] border-[3px] border-[#00376B] bg-[rgba(20,60,110,0.7)] font-display text-[11px] leading-none text-white [--stroke-width:0] ${SEAT_RING}`}>
              +{overflow}
            </div>
          )}
        </div>
      )}

      <Button variant={full ? 'blue' : 'green'} size="sm" disabled={busy} onClick={() => onJoin?.()} className="shrink-0">
        {full ? `👁 ${label}` : label}
      </Button>
    </Card>
  )
}
