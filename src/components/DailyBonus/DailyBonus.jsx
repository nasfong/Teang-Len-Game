import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import ProgressBar from '../ProgressBar/ProgressBar.jsx'
import Badge from '../Badge/Badge.jsx'
// Co-located art, so the folder still copies out whole.
import badgeIcon from './badge.webp'
import giftIcon from './gift.webp'

// DailyBonus — a reward panel: a heading, a line of body copy with an icon to its
// right, a progress meter (e.g. days claimed this week), and an optional Claim
// button. Composite (Card + ProgressBar + Button), so copying it out brings those
// folders too.
//
// Config-driven and reusable: every string, the icon, the meter and the action are
// props, so the same shell serves a daily login streak, a battle-pass tier, an
// event goal — anything that's "some copy + an icon + a bar + a claim". `icon` is
// any node (emoji, <img>, <svg>), like Footer's menu items, so a real reward image
// drops straight in.

/**
 * @param heading       panel title (default 'Daily Bonus')
 * @param body          description line beside the icon
 * @param icon          node shown to the RIGHT of the body (emoji / <img> / <svg>)
 * @param value,max     progress meter amounts (see ProgressBar)
 * @param color         meter colour: 'green' | 'lime' | 'blue' | 'red'
 * @param progressLabel overrides the meter's default `${value}/${max}`
 * @param onClaim       when given, renders a Claim button; omit to hide it
 * @param claimLabel    Claim button text (default 'Claim')
 * @param claimed       locks the button and shows the claimed label
 */
export default function DailyBonus({
  heading = 'Daily Bonus',
  body = 'Log in every day to keep your streak going and earn bigger rewards!',
  icon = <img src={giftIcon} alt="" />,
  value = 0,
  max = 100,
  color = 'green',
  progressLabel,
  onClaim,
  claimLabel = 'Claim',
  claimed = false,
  className = '',
}) {
  return (
    <Card className={`relative w-full max-w-sm flex-col gap-3 p-4 tall:gap-4 tall:p-5 ${className}`}>
      {heading && (
        <Badge color="green" icon={<img src={badgeIcon} alt="" />} className='absolute -top-8'>
          {heading}
        </Badge>
      )}

      {/* Body copy + icon on the right. The text takes the slack (flex-1), the icon
          holds its size (shrink-0) — so a longer line reflows without squeezing the
          art. items-center keeps the icon vertically centred on the copy. */}
      <div className="flex items-center gap-4 mt-2 tall:mt-3">
        <p className="flex-1 font-display text-sm leading-snug text-white/90 [--stroke-width:2px] [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] tall:text-base">
          {body}
          <ProgressBar value={value} max={max} color={color} label={progressLabel} />
        </p>
        {icon != null && (
          <span className="shrink-0 text-4xl leading-none drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)] [&>img]:size-20 [&>img]:object-contain [&>svg]:size-12 tall:text-5xl tall:[&>img]:size-30 tall:[&>svg]:size-16">
            {icon}
          </span>
        )}
      </div>


      {onClaim && (
        <div className="flex justify-center">
          <Button variant="green" size="sm" outline="navy" disabled={claimed} onClick={onClaim}>
            {claimed ? 'Claimed' : claimLabel}
          </Button>
        </div>
      )}
    </Card>
  )
}
