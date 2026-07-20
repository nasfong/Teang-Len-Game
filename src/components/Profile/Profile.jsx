import Card from '../Card/Card.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import Button from '../Button/Button.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// Profile — the player's own card: who they are, what they're holding, how they
// play. Composite (Card + Avatar + Button), so copying it out brings all three.
//
// This is what the Footer's Profile menu opens:
//
//   <Modal open={open} onClose={close}>
//     <Profile bare name={user.name} coin={wallet} played={42} won={28} onLogout={…} />
//   </Modal>
//
// SIZING: no width of its own — it fills the column or modal it's given, like
// FriendList and Chat.

// Same carved groove as the Footer's menu: a dark hairline with a white
// highlight down one side, so it reads as moulded from the panel.
const DIVIDER = 'my-2 w-px shrink-0 self-stretch bg-[#00376B]/45 shadow-[1px_0_0_rgba(255,255,255,0.22)]'

/** Colour is passed in per call rather than baked in here — two text-colour
 *  classes on one element would collide, and Tailwind resolves that by
 *  stylesheet order, not by who asked last. */
function Stat({ value, label, tone = 'text-white' }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 py-2.5">
      <span className={`font-display text-2xl leading-none ${tone} [--stroke-color:#0F3358]`}>{value}</span>
      <span className="font-display text-[11px] leading-none text-white/60 [--stroke-width:0]">{label}</span>
    </div>
  )
}

/**
 * @param played/won  the record. Win rate is DERIVED, never a prop — a caller
 *                    passing all three could contradict itself.
 * @param onEditAvatar  optional; shows the edit affordance only when given
 * @param bare        drop the Card shell, for nesting in a Modal (which brings
 *                    its own). See FriendList for the same escape hatch.
 */
export default function Profile({
  name = 'Player',
  avatarSrc,
  coin = 0,
  played = 0,
  won = 0,
  title = 'Profile',
  onEditAvatar,
  onLogout,
  logoutLabel = 'Log Out',
  bare = false,
  className = '',
}) {
  const rate = played > 0 ? Math.round((won / played) * 100) : 0

  const body = (
    <>
      <div className="px-1 font-display text-xl text-white [--stroke-color:#0F3358]">👤 {title}</div>

      {/* Identity */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <Avatar name={name} src={avatarSrc} size="lg" />
          {onEditAvatar && (
            // Wrapper takes the offset — Button's root is `relative` for its slab,
            // so a position class handed to it gets dropped.
            <span className="absolute -right-2 -bottom-2">
              <Button shape="circle" size="sm" variant="blue" outline="navy" glossy={false} aria-label="Change photo" onClick={onEditAvatar}>
                ✏️
              </Button>
            </span>
          )}
        </div>

        {/* min-w-0 + truncate: a long name would otherwise stretch the panel */}
        <span className="w-full truncate text-center font-display text-2xl text-white [--stroke-color:#0F3358]">
          {name}
        </span>
        <span className="font-display text-lg leading-none text-[#FFD27A] [--stroke-color:#7A4A10]">
          <CoinIcon /> {coin.toLocaleString()}
        </span>
      </div>

      {/* Record — the reason you open your own profile */}
      <div className="flex rounded-2xl bg-black/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
        <Stat value={played} label="Played" />
        <span aria-hidden className={DIVIDER} />
        <Stat value={won} label="Won" tone="text-[#9fe03a]" />
        <span aria-hidden className={DIVIDER} />
        <Stat value={`${rate}%`} label="Win rate" tone="text-[#FFD27A]" />
      </div>

      {onLogout && (
        <div className="flex justify-center">
          <Button variant="red" size="sm" onClick={onLogout}>
            {logoutLabel}
          </Button>
        </div>
      )}
    </>
  )

  // No padding when bare — the host panel already has its own.
  if (bare) return <div className={`flex w-full flex-col gap-3 ${className}`}>{body}</div>

  return <Card className={`w-full flex-col gap-3 p-3 ${className}`}>{body}</Card>
}
