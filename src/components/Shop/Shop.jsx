import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import CoinIcon from '../CoinIcon/CoinIcon.jsx'

// Shop — buy coins. Composite (Card + Button), so copying it out brings both.
//
// This is what the Footer's Shop menu opens:
//
//   <Modal open={open} onClose={close}>
//     <Shop bare balance={wallet} onBuy={(pack) => checkout(pack.id)} busyId={pending} />
//   </Modal>
//
// Coins are the whole economy here — you bet them, win them, lose them, and the
// Header and Profile both show the balance — so that's what a shop sells.
//
// SIZING: no width of its own; the grid fills whatever column or modal it's given.

// Real prices come from a store/server. These exist so the component renders
// standalone in the gallery, same as FriendList's DEFAULT_FRIENDS. The first entry
// is the rewarded-video row (kind 'ad'): watch a clip, claim free coins — routed to
// onWatchAd, not onBuy. It spans the full width so the paid packs stay a tidy 2×2.
const DEFAULT_PACKS = [
  { id: 'ad', kind: 'ad', wide: true, coins: 500, icon: '🎬', cta: '▶ Watch', accent: 'blue', subtitle: 'Watch a video, claim free coins' },
  { id: 'starter', coins: 1000, price: '$0.99' },
  { id: 'stack', coins: 5500, price: '$4.99', bonus: '+10%' },
  { id: 'pile', coins: 12000, price: '$9.99', bonus: '+20%', tag: 'Best value' },
  { id: 'vault', coins: 30000, price: '$19.99', bonus: '+25%' },
]

/** One pack. The coin count leads — it's the number you compare packs by, the
 *  same call RoomCard makes with its stake. `wide` renders the full-width rewarded-
 *  video row instead (horizontal: icon + copy + a Watch button). */
function Pack({ coins, price, cta, accent = 'green', subtitle, bonus, tag, icon = <CoinIcon />, busy = false, disabled = false, wide = false, onBuy }) {
  if (wide) {
    return (
      <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-black/20 px-3 py-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
        <span className="text-3xl leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">{icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-sm text-white [--stroke-width:0]">{subtitle}</span>
          <span className="font-display text-lg leading-none text-[#FFD27A] [--stroke-color:#7A4A10]">
            +{coins.toLocaleString()} <CoinIcon />
          </span>
        </div>
        <Button variant={accent} size="sm" disabled={busy || disabled} onClick={onBuy}>
          {busy ? 'Playing…' : (cta ?? 'Watch')}
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center gap-1.5 rounded-2xl bg-black/20 px-3 pt-3 pb-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
      {/* Sits on the tile's top edge, so it can't push the contents around as
          only one pack has it. */}
      {tag && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border-2 border-[#7A4A10] bg-[linear-gradient(180deg,#FFE08A_0%,#FFB23E_100%)] px-2 py-px font-display text-[10px] whitespace-nowrap text-[#5A3408] [--stroke-width:0]">
          {tag}
        </span>
      )}

      <span className="text-3xl leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">{icon}</span>

      <span className="font-display text-xl leading-none text-[#FFD27A] [--stroke-color:#7A4A10]">
        {coins.toLocaleString()}
      </span>

      {/* Reserved even when empty, so tiles with and without a bonus stay the
          same height and the buttons line up across the grid. */}
      <span className="h-3.5 font-display text-[11px] leading-none text-[#9fe03a] [--stroke-width:0]">{bonus}</span>

      <Button variant={accent} size="sm" disabled={busy || disabled} onClick={onBuy} className="mt-0.5">
        {busy ? '…' : price}
      </Button>
    </div>
  )
}

/**
 * @param packs   [{ id, coins, price, bonus?, tag?, icon? }]
 * @param balance current coins — shown in the header; omit to hide it
 * @param busyId  id of the pack being purchased (a checkout is async)
 * @param onBuy      (pack) => void — passes the whole pack, not just the id, so the
 *                   caller doesn't have to look it back up
 * @param onWatchAd  (pack) => void — the rewarded-video row (kind 'ad') routes here
 *                   instead of onBuy; the caller plays the ad and credits the coins
 * @param bare       drop the Card shell, for nesting in a Modal (which brings its
 *                   own). Same escape hatch as FriendList / Profile.
 */
export default function Shop({
  packs = DEFAULT_PACKS,
  balance,
  title = 'Shop',
  busyId,
  onBuy,
  onWatchAd,
  emptyText = 'Nothing for sale right now.',
  bare = false,
  className = '',
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between px-1">
        <span className="font-display text-xl text-white [--stroke-color:#0F3358]">🛍️ {title}</span>
        {balance != null && (
          <span className="font-display text-sm text-[#FFD27A] [--stroke-width:0]"><CoinIcon /> {balance.toLocaleString()}</span>
        )}
      </div>

      {packs.length === 0 ? (
        <p className="px-2 py-8 text-center font-display text-sm text-white/60 [--stroke-width:0]">{emptyText}</p>
      ) : (
        // pt-2 leaves room for the "Best value" tag hanging off the first row.
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {packs.map((p) => (
            <Pack
              key={p.id}
              {...p}
              busy={busyId === p.id}
              // Any purchase in flight locks the rest — two checkouts at once is
              // a double charge, not a feature.
              disabled={busyId != null && busyId !== p.id}
              onBuy={() => (p.kind === 'ad' ? onWatchAd : onBuy)?.(p)}
            />
          ))}
        </div>
      )}
    </>
  )

  // No padding when bare — the host panel already has its own.
  if (bare) return <div className={`flex w-full flex-col gap-2.5 ${className}`}>{body}</div>

  return <Card className={`w-full flex-col gap-2.5 p-3 ${className}`}>{body}</Card>
}
