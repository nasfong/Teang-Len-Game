import tableBg from './table-background.webp'
import Avatar from '../Avatar/Avatar.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'
import EmoteBubble from '../EmoteBubble/EmoteBubble.jsx'
import TurnTimer from '../TurnTimer/TurnTimer.jsx'

// Card-game table — the illustrated room + felt octagon from table-background.png,
// with player profile seats placed around it. Config-driven: pass a `players`
// array and it lays the seats out AROUND the table (seat 0 = local player, tucked
// into the bottom-left corner; then right / top / left for the opponents, so the
// seat order walks a ring). `currentTurn`
// glows the active seat; pass `turnSeconds` and it rings that seat with a
// draining TurnTimer instead (`turnKey` re-arms the ring each turn, `onTurnExpire`
// fires when it runs out). `children` fills the felt centre (the trick pile)
// and `hand` fills the front rim (the local player's fan) — kept as two slots so
// the trick pile and the hand place independently. `opponentHands` (a node per
// seat, seat 0 skipped) tucks each opponent's face-down hand by their seat. A
// player's `emote` ({ id, emoji }) pops over their profile and clears itself.
// Uses font-display.
//
// The art is a real <img>, not a Tailwind bg-[url(…)] class: Vite hashes the
// filename at build time, and Tailwind can only read class strings that are
// literal in the source — so the class could never name the built path. An <img>
// takes it as a prop and keeps the component free of inline styles.
//
// PORTABLE: table-background.png is co-located — copy the whole folder.

// The frame's ratio matches the artwork (1527x704). If you change it, the art
// gets object-cover'd — i.e. cropped — and the seat percentages below drift off
// the felt, since they're tuned to this perspective.
const FRAME = [
  'relative aspect-[1527/704] w-[860px] max-w-full overflow-hidden',
  'rounded-[28px] border-[3px] border-[#00376B]',
  'bg-[#1c2b3a] shadow-[0_10px_30px_rgba(0,0,0,0.45)]',
].join(' ')

// Seat spots are tuned to the artwork's perspective: the felt octagon spans
// roughly 19–81% across and 25–75% down, so these sit just outside its edge —
// top past the far rim, left/right beyond the corners.
//
// The local player (always seat 0 → the `bottom` role) is tucked into the
// bottom-LEFT corner rather than centred on the front rim, which clears the whole
// width of the front of the felt for their hand fan — the busiest thing on the
// table. It's corner-anchored (no -translate), so it hugs the frame edge where
// the vignette is darkest and the pill reads cleanly. The other three stay
// centred on their edges via -translate.
const SEAT_POS = {
  bottom: 'bottom-[3%] left-[2%]',
  top: 'top-[2%] left-1/2 -translate-x-1/2',
  left: 'left-[2%] top-1/2 -translate-y-1/2',
  right: 'right-[2%] top-1/2 -translate-y-1/2',
}
// Ordered to go AROUND the table, not across it: seat 0 (local) at the bottom,
// then right, top, left. So advancing seat-by-seat (0→1→2→3) walks a real ring —
// bottom → right → top → left → bottom — which is the turn order the game uses.
const SEAT_ORDER = ['bottom', 'right', 'top', 'left']

// Where an opponent's single face-down card sits — right beside their avatar on
// the felt-facing side, the way the reference client places it (top seat: card to
// the avatar's right; side seats: card toward the centre). Seat 0 (the local
// player) has no entry: their hand is the fan in the `hand` slot along the front
// rim. These percentages are visual dials.
const OPP_HAND_POS = {
  top: 'top-[3%] left-[53%]',
  left: 'top-1/2 left-[11%] -translate-y-1/2',
  right: 'top-1/2 right-[11%] -translate-y-1/2',
}

// Children sit well inside the felt (25–75% across, 32–68% down) so cards never
// ride up onto the painted wooden rim.
const CENTRE = 'absolute inset-x-[25%] inset-y-[32%] flex items-center justify-center'

const DEFAULT_PLAYERS = [
  { name: 'You', coin: 1250, host: true },
  { name: 'Sophea', coin: 980 },
  { name: 'Dara', coin: 3400 },
  { name: 'Rith', coin: 210 },
]

// Seat size tiers. This game is played in phone LANDSCAPE, where vertical space is
// the scarce resource and the felt + cards must win — so OPPONENTS are the small
// tier and the local player is only slightly larger.
//
// Both tiers use the 44px avatar because TurnTimer's overlay ring bottoms out at
// `sm` (56px): a 32px `xs` avatar would sit inside a ring half again its size. So
// the reduction comes from the avatar dropping 64px → 44px and the column 96px →
// 64px, not from going smaller still.
const SEAT_SIZES = {
  sm: { box: 'w-16', avatar: 'sm', timer: 'sm', pill: 'px-2', name: 'text-[11px]', coin: 'text-[10px]' },
  md: { box: 'w-20', avatar: 'sm', timer: 'sm', pill: 'px-3', name: 'text-xs', coin: 'text-[11px]' },
}

/** One player profile: gold avatar (photo or initial), name pill, coin balance.
 *  `emote` is { id, emoji } — hand it the latest and EmoteBubble clears itself.
 *  `size` picks a tier from SEAT_SIZES — 'sm' for opponents, 'md' for the local
 *  player. `turnSeconds`, when the seat is active, rings the avatar with a draining
 *  TurnTimer. */
function PlayerSeat({ name = 'Player', coin, avatarSrc, host = false, active = false, afk = false, emote, size = 'md', turnSeconds, turnKey, onTurnExpire }) {
  const s = SEAT_SIZES[size] ?? SEAT_SIZES.md
  // On turn, the avatar wears the countdown ring instead of the idle scale-up:
  // the draining ring is the stronger "it's them" signal, and scaling would fight
  // the ring's overlay.
  const ringed = active && turnSeconds != null

  return (
    <div className={`flex ${s.box} flex-col items-center gap-1`}>
      {/* The crown hangs off the avatar's corner and the emote pops above it, so
          both need this wrapper to anchor to. It also carries the ground shadow
          that lifts a seat off the painted room — `drop-shadow` (a filter) rather
          than `shadow`, so it follows the avatar's rounded silhouette instead of
          boxing it. */}
      <div
        className={`relative drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] transition-transform duration-200 ${
          active && !ringed ? 'scale-105' : ''
        } ${afk ? 'opacity-60 grayscale' : ''}`}
      >
        {/* Round seats — a circle is what the countdown ring hugs cleanly. */}
        <Avatar name={name} src={avatarSrc} size={s.avatar} shape="circle" active={active} />
        {/* AFK badge — a disconnected player whose turns a bot is covering. */}
        {afk && (
          <span className="absolute -bottom-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#E0483C] px-1.5 py-0.5 font-display text-[10px] leading-none text-white [--stroke-width:0] shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
            AFK
          </span>
        )}
        {/* The ring floats ON TOP of the avatar at full size, rather than shrinking
            it into the middle of a bigger box. key re-arms it each turn (a CSS
            animation only restarts on remount); onExpire drives auto-play/pass. */}
        {ringed && (
          <TurnTimer overlay key={turnKey} size={s.timer} seconds={turnSeconds} onExpire={onTurnExpire} />
        )}
        {host && (
          <span className="absolute -top-2.5 -right-1 z-10 text-lg drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">👑</span>
        )}
        <EmoteBubble emote={emote} />
      </div>

      {/* Pill + coin are darker than the plain look would need: they sit over busy
          painted scenery, so they carry their own contrast rather than relying on
          whatever pixel lands behind them. */}
      <div className="w-full rounded-full border border-white/15 bg-black/65 px-3 py-0.5 backdrop-blur-[2px]">
        <div
          className={`truncate text-center font-display ${
            compact ? 'text-xs' : 'text-sm'
          } text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]`}
        >
          {name}
        </div>
      </div>

      {coin != null && (
        <div
          className={`font-display ${compact ? 'text-[11px]' : 'text-xs'} text-[#FFD27A] [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]`}
        >
          <CoinIcon /> {coin.toLocaleString()}
        </div>
      )}
    </div>
  )
}

export default function Table({ players = DEFAULT_PLAYERS, currentTurn = 0, turnSeconds, turnKey, onTurnExpire, children, hand, opponentHands = [], fill = false, className = '' }) {
  // `fill` drops the fixed 860px / fixed-aspect box and fills the parent instead —
  // for a full-screen table on a phone, where the board IS the page (see TablePage).
  // The felt art object-covers either way; the seat percentages still sit at the
  // edges/corners, so they read fine at any aspect (they were only pixel-perfect on
  // the felt at the original ratio). No rounded frame/border when full-bleed.
  const frame = fill
    ? 'relative size-full overflow-hidden bg-[#1c2b3a]'
    : FRAME
  return (
    <div className={`${frame} ${className}`}>
      <img src={tableBg} alt="" aria-hidden decoding="sync" className="absolute inset-0 size-full object-cover" draggable={false} />

      {/* Vignette — darkens the painted room's edges so the seats and the felt
          centre read first. The art is busy right up to its corners. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.5)_100%)]"
      />

      <div className={CENTRE}>{children}</div>

      {/* Profile seats, auto-placed around the table. Seat 0 is the local player
          (compact, bottom-left corner); the active seat gets the countdown ring
          when `turnSeconds` is set. */}
      {players.slice(0, 4).map((player, i) => (
        <div key={i} className={`absolute z-10 ${SEAT_POS[SEAT_ORDER[i]]}`}>
          <PlayerSeat
            {...player}
            active={i === currentTurn}
            compact={i === 0}
            turnSeconds={i === currentTurn ? turnSeconds : undefined}
            turnKey={turnKey}
            onTurnExpire={i === currentTurn ? onTurnExpire : undefined}
          />
        </div>
      ))}

      {/* Opponents' face-down hands, tucked by each seat. Indexed by seat, like
          `players`; seat 0 is skipped (that's the local player, whose hand is the
          front-rim fan below). The page builds the <Hand faceDown> nodes, so Table
          still imports no Hand — same contract as `hand` and `children`. */}
      {opponentHands.map((node, i) =>
        node && i !== 0 && OPP_HAND_POS[SEAT_ORDER[i]] ? (
          <div key={i} className={`absolute z-10 ${OPP_HAND_POS[SEAT_ORDER[i]]}`}>
            {node}
          </div>
        ) : null,
      )}

      {/* Local player's hand — its own slot along the front rim, centred across
          the full width because the You seat vacated the middle. z-20 so the fan
          reads over the seats and the trick pile. Like `children`, the page passes
          the <Hand> node in, so Table keeps no Hand dependency.
          Pulled flush to the bottom edge (-bottom-8 cancels Hand's own pb-8), so
          the cards' bottoms sit on the frame's edge and the overflow-hidden trims
          the empty padding below — the hand reads as anchored to the bottom. */}
      {hand && <div className="absolute inset-x-0 -bottom-8 z-20 flex justify-center">{hand}</div>}
    </div>
  )
}
