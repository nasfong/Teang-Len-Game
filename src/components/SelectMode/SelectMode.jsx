import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
// Co-located mode art, so the folder still copies out whole.
import soloImg from './solo.webp'
import withFriendImg from './with-friend.webp'
import onlineImg from './online.webp'

// SelectMode — a panel of game modes to pick from: a Card holding a row of options,
// each an ICON-ONLY Button with its label sitting BELOW the button (outside it).
// Composite (Card + Button), so copying it out brings both folders.
//
// The button carries only the icon; the label is a separate line under it — so the
// button stays a clean round target and the words never crowd the art. The button's
// aria-label is the mode name (the visible label is a sibling, not its content), and
// aria-pressed marks the chosen one for assistive tech.
//
// Controlled: the caller owns which mode is selected (`value`) and hears picks via
// onSelect(id) — the same split the rest of the workbench uses, so a store can drive
// it. `icon` is any node (emoji, <img>, <svg>), like Footer's menu items.

// One shared size for the art so the three read as a set (see Footer's icons for
// the same reasoning). object-contain keeps each one's own aspect.
const ICON = 'size-11 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] tall:size-16'

const DEFAULT_MODES = [
  { id: 'online', icon: <img src={onlineImg} alt="" className={ICON} />, label: 'Online' },
  { id: 'with_friends', icon: <img src={withFriendImg} alt="" className={ICON} />, label: 'With Friends' },
  { id: 'solo', icon: <img src={soloImg} alt="" className={ICON} />, label: 'Solo' },
]

/**
 * @param modes     [{ id, icon, label }] — the options (default: Solo / With Friends / Online)
 * @param value     id of the selected mode
 * @param onSelect  (id) => void
 * @param title     heading over the row (default 'Select Mode'); pass null to hide
 */
export default function SelectMode({
  modes = DEFAULT_MODES,
  value,
  onSelect,
  title = 'Select Mode',
  className = '',
}) {
  return (
    <Card className={`flex-col items-center gap-3 p-4 tall:gap-5 tall:p-6 ${className}`} size="sm">
      {title && (
        <h2 className="font-display text-xl tracking-[0.5px] text-white [--stroke-color:#1B4E86] drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)] tall:text-2xl">
          {title}
        </h2>
      )}

      {/* Wraps so a long list reflows on a narrow phone instead of overflowing. */}
      <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-3 tall:gap-x-10 tall:gap-y-4">
        {modes.map((m) => {
          const active = m.id === value
          return (
            <div key={m.id} className="flex w-16 flex-col items-center gap-2">
                <Button
                  shape="icon"
                  size="lg"
                  sizeTall="xl"
                  variant={active ? 'green' : 'blue'}
                  aria-label={m.label}
                  aria-pressed={active}
                  onClick={() => onSelect?.(m.id)}
                  glossy={false}
                >
                  {m.icon}
                </Button>

              <span
                className={` text-center font-display text-sm leading-tight text-nowrap ${
                  active ? 'text-[#FFD27A]' : 'text-white/80'
                }`}
              >
                {m.label}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
