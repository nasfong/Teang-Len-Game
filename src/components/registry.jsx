// Component registry — the ONE place you edit to add a component to the workbench.
//
// Each entry points at a self-contained folder under src/components/<Name>/.
// Keep components portable: style with Tailwind classes only (no CSS files) and
// co-locate any assets inside the folder, so the whole folder can be copied to
// another project (one that also has Tailwind).
//
// `status` is just a label for the workbench sidebar:
//   'wip'  – still building
//   'done' – complete, ready to copy out
//
// To add a component:
//   1. Create src/components/MyThing/MyThing.jsx
//   2. Import it below and add an entry to the array.

import { useState } from 'react'
import Button from './Button/Button.jsx'
import Card from './Card/Card.jsx'
import Header from './Header/Header.jsx'
import Table from './Table/Table.jsx'
import SquareToggle from './SquareToggle/SquareToggle.jsx'
import TextField from './TextField/TextField.jsx'
import Slider from './Slider/Slider.jsx'
import CreateRoomForm from './CreateRoomForm/CreateRoomForm.jsx'
import AuthForm from './AuthForm/AuthForm.jsx'
import RoomCard from './RoomCard/RoomCard.jsx'
import HintBubble from './HintBubble/HintBubble.jsx'
import FriendList from './FriendList/FriendList.jsx'
import Modal from './Modal/Modal.jsx'
import PlayingCard from './PlayingCard/PlayingCard.jsx'
import Hand from './Hand/Hand.jsx'
import TrickPile from './TrickPile/TrickPile.jsx'
import TurnTimer from './TurnTimer/TurnTimer.jsx'
import Avatar from './Avatar/Avatar.jsx'
import CoinIcon from './CoinIcon/CoinIcon.jsx'
import ResultModal from './ResultModal/ResultModal.jsx'
import Chat from './Chat/Chat.jsx'
import EmoteBubble from './EmoteBubble/EmoteBubble.jsx'
import EmoteBar from './EmoteBar/EmoteBar.jsx'
import Footer from './Footer/Footer.jsx'
import Profile from './Profile/Profile.jsx'
import Shop from './Shop/Shop.jsx'
import GameTable from './GameTable/GameTable.jsx'
import KantealDemo from '../games/kanteal/Demo.jsx'
import HomePage from './HomePage/HomePage.jsx'
import RoomPage from './RoomPage/RoomPage.jsx'
import TablePage from './TablePage/TablePage.jsx'
import LoginPage from './LoginPage/LoginPage.jsx'
import SelectMode from './SelectMode/SelectMode.jsx'
import ProgressBar from './ProgressBar/ProgressBar.jsx'
import DailyBonus from './DailyBonus/DailyBonus.jsx'
import Badge from './Badge/Badge.jsx'
// The lobby's glass panel needs art behind it to frost — reuse HomePage's landing
// background for the RoomPage preview.
import homeBackground from './HomePage/background.webp'
// The menu's art belongs to the page that defines the menu, not to the bar that
// lays it out — so it lives here in src/assets/, not in Footer's folder.
import friendIcon from '../assets/icons/friend.webp'
import profileIcon from '../assets/icons/profile.webp'
import shopIcon from '../assets/icons/shop.webp'
// The CreateRoom heading's art, so it lives in that component's folder — the
// modal chrome around the form is still the page's call, which is why the
// heading is assembled here rather than inside CreateRoomForm.
import cardsIcon from './CreateRoomForm/card.webp'
import keysIcon from './CreateRoomForm/keys.webp'

// SelectMode is controlled — the preview owns which mode is picked.
const SelectModePreview = () => {
  const [mode, setMode] = useState('solo')
  return <SelectMode value={mode} onSelect={setMode} />
}

// ProgressBar — the four colours, then a live one you can drive.
const ProgressBarPreview = () => {
  const [n, setN] = useState(10)
  return (
    <div className="flex w-80 flex-col gap-6">
      {[
        ['green', 8, 10],
        ['lime', 10, 20],
        ['blue', 45, 100],
        ['red', 3, 5],
      ].map(([color, v, m]) => (
        <div key={color} className="flex flex-col gap-1.5">
          <span className="font-display text-xs text-white/60 [--stroke-width:0]">color="{color}"</span>
          <ProgressBar color={color} value={v} max={m} />
        </div>
      ))}

      <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
        <ProgressBar color="lime" value={n} max={20} size="lg" />
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="blue" onClick={() => setN((v) => Math.max(0, v - 2))}>
            −
          </Button>
          <span className="min-w-16 text-center font-display text-sm text-white/70 [--stroke-width:0]">{n}/20</span>
          <Button size="sm" variant="green" onClick={() => setN((v) => Math.min(20, v + 2))}>
            +
          </Button>
        </div>
      </div>
    </div>
  )
}

// Badge — the four colours, one with the leading icon toggled off.
const BadgePreview = () => (
  <div className="flex flex-col items-center gap-5">
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Badge color="green" icon="🏆">
        Daily Bonus
      </Badge>
      <Badge color="lime" icon="⚡">
        Streak
      </Badge>
      <Badge color="blue" icon="💎">
        Rank
      </Badge>
      <Badge color="red" icon="🔥">
        Hot
      </Badge>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Badge color="blue" size="sm" icon="⭐">
        sm
      </Badge>
      <Badge color="blue" size="lg" icon="⭐">
        lg
      </Badge>
      {/* showIcon={false} hides the leading icon even though one is passed. */}
      <Badge color="green" icon="🏆" showIcon={false}>
        No icon
      </Badge>
    </div>
  </div>
)

// DailyBonus — the reward card; the preview owns the claim state.
const DailyBonusPreview = () => {
  const [claimed, setClaimed] = useState(false)
  return (
    <DailyBonus
      value={4}
      max={7}
      color="green"
      progressLabel="4/7 days"
      claimed={claimed}
      onClaim={false}
    />
  )
}

// Card takes children — show both skins (solid + glass) and the deco flourish.
const CardPreview = () => (
  <div className="flex flex-wrap items-center justify-center gap-10">
    <Card>
      <span className="font-display text-2xl uppercase text-white [--stroke-color:#00376B]">
        Solid
      </span>
    </Card>
    <Card variant="glass">
      <span className="font-display text-2xl uppercase text-white [text-shadow:0_2px_3px_rgba(0,0,0,0.4)]">
        Glass
      </span>
    </Card>
    {/* deco — border cards straddle the sides, so give the panel some height for
        the low piles to sit in. Any Card can wear it now (not just Modal). */}
    <Card deco className="min-h-64 w-72 flex-col items-center justify-center p-6">
      <span className="font-display text-2xl uppercase text-white [--stroke-color:#00376B]">
        Deco
      </span>
    </Card>
  </div>
)

// Icons for the circle buttons — currentColor picks up the face's text-white.
const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// Show the Button variants + sizes, and both outline inks side by side.
const ButtonPreview = () => (
  <div className="flex flex-col items-center gap-8">
    <div className="flex flex-wrap items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Button variant="green" size="lg">
          PLAY
        </Button>
        <span className="font-display text-xs tracking-wider text-white/70 uppercase">outline="variant"</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button variant="green" size="lg" outline="navy">
          PLAY
        </Button>
        <span className="font-display text-xs tracking-wider text-white/70 uppercase">outline="navy"</span>
      </div>
    </div>

    <div className="flex items-center gap-4">
      <Button variant="blue">Cancel</Button>
      <Button variant="lime">Create</Button>
      <Button variant="red">Log Out</Button>
    </div>
    <div className="flex items-center gap-4">
      <Button variant="blue" outline="navy">
        Cancel
      </Button>
      <Button variant="lime" outline="navy">
        Create
      </Button>
      <Button variant="red" outline="navy">
        Log Out
      </Button>
    </div>

    <div className="flex items-center gap-4">
      <Button variant="green" size="sm">
        Small
      </Button>
      <Button variant="blue" size="sm" disabled>
        Disabled
      </Button>
    </div>

    {/* shape="circle" — icon on its own, no label. md is the 46px Back button. */}
    <div className="flex items-center gap-4">
      <Button shape="circle" size="sm" variant="blue" outline="navy" aria-label="Back">
        <BackIcon />
      </Button>
      <Button shape="circle" variant="blue" outline="navy" aria-label="Back">
        <BackIcon />
      </Button>
      <Button shape="circle" size="lg" variant="blue" outline="navy" aria-label="Back" glossy={false}>
        <BackIcon />
      </Button>
      <Button shape="circle" variant="lime" aria-label="Settings" glossy={false}>
        ⚙️
      </Button>
      <Button shape="circle" variant="red" aria-label="Close" glossy={false}>
        ✕
      </Button>
    </div>

    {/* shape="icon" — square box with the pill's rounded corners (a squircle) */}
    <div className="flex items-center gap-4">
      <Button shape="icon" size="sm" variant="blue" outline="navy" aria-label="Back">
        <BackIcon />
      </Button>
      <Button shape="icon" variant="blue" outline="navy" aria-label="Back">
        <BackIcon />
      </Button>
      <Button shape="icon" size="lg" variant="lime" aria-label="Settings" glossy={false}>
        ⚙️
      </Button>
      <Button shape="icon" size="xl" variant="red" aria-label="Close" glossy={false}>
        ✕
      </Button>
    </div>
  </div>
)

// SquareToggle is controlled — demo it as a Max Players segmented row.
const SquareTogglePreview = () => {
  const [players, setPlayers] = useState(4)
  return (
    <div className="flex items-center gap-3.5">
      <span className="font-display text-lg text-white [--stroke-color:#1B4E86]">
        Max Players
      </span>
      <div className="flex gap-2">
        {[2, 3, 4].map((n) => (
          <SquareToggle key={n} active={players === n} onClick={() => setPlayers(n)}>
            {n}
          </SquareToggle>
        ))}
      </div>
    </div>
  )
}

const TextFieldPreview = () => (
  <div className="flex w-[320px] flex-col gap-4">
    <TextField icon="✏️" placeholder="Room name" maxLength={24} />
    <TextField icon="🔒" type="password" placeholder="Password" />
  </div>
)

const SliderPreview = () => (
  <div className="w-95">
    <Slider label="Bet Amount" />
  </div>
)

// Forms own their own state; give the previews no-op handlers.

// The icons are OUT OF FLOW, hung off the text's two edges, so the heading's box
// is the words and nothing else — h-9 is now a free dial. Resize it and the text
// doesn't budge and the h2 doesn't grow; the art just gets bigger where it sits.
// In flow they'd inflate the line box, and since Modal pins the heading by its
// TOP edge, a taller box hangs further down over the card — i.e. the icon size
// was quietly setting the heading's height.
//
// Sized by HEIGHT with a natural width, the call FooterItem makes: the art has
// mixed aspects (a wide card fan, a tall key), so a square box would letterbox
// each differently and they'd read as two different sizes. One height, and they
// match. max-w-none because preflight caps images at 100% of their container —
// which is now just the text, so a big enough icon would silently squash.
// Decorative: the words carry the meaning, so alt="".
const HEADING_ICON = 'absolute top-1/2 h-12 w-auto max-w-none -translate-y-1/2 drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)]'

// right-full / left-full put each icon's inner edge exactly on a text edge; the
// margin is then the gap. They grow OUTWARD from there, so they can never crowd
// the words.
// Trade-off: this centres the TEXT on the card, not the icons+text as a group.
// The fan is wider than the key, so the group leans left by a few px. Centring
// the group instead would push the words off-centre, and the words are the
// heading — worth revisiting only if the art ends up matched in width.
const CREATE_ROOM_HEADING = (
  <span className="relative inline-block">
    <img src={cardsIcon} alt="" className={`${HEADING_ICON} right-full mr-2.5`} />
    CREATE ROOM
    <img src={keysIcon} alt="" className={`${HEADING_ICON} left-full ml-2.5`} />
  </span>
)

const CreateRoomFormPreview = () => {
  const [open, setOpen] = useState(true)

  return (
    <Modal open={open} deco onClose={() => setOpen(false)} heading={CREATE_ROOM_HEADING}>
      <CreateRoomForm
        balance={12000}
        games={[
          { id: 'teanglen', name: 'Teang Len', minPlayers: 2, maxPlayers: 4 },
          { id: 'kanteal', name: 'Kanteal', minPlayers: 2, maxPlayers: 4 },
        ]}
        onCancel={() => { }}
        onSubmit={(values) => console.log('create room', values)}
      />
    </Modal>
  )
}

const AuthFormPreview = () => <AuthForm onSubmit={(values) => console.log('auth', values)} />

// The bubble is absolute now, so it needs an anchor to pin to — this stands in
// for a field without dragging TextField into the preview.
const MockField = ({ label, children }) => (
  <div className="relative w-44 rounded-[18px] border-[3px] border-[#1B4E86] bg-black/25 px-4 py-3 shadow-[inset_0_3px_6px_rgba(0,0,0,0.35)]">
    <span className="font-display text-lg text-white">{label}</span>
    {children}
  </div>
)

// Row 1: the three variants at the default 'right' placement.
// Row 2: the four sides. Gaps are wide enough that floating bubbles don't overlap.
const HintBubblePreview = () => (
  <div className="flex flex-col items-center gap-14 py-10">
    <div className="flex flex-wrap justify-center gap-x-64 gap-y-10">
      <MockField label="Username">
        <HintBubble variant="error">Passwords don’t match</HintBubble>
      </MockField>
      <MockField label="Room name">
        <HintBubble variant="info">Pick a name your friends will spot</HintBubble>
      </MockField>
      <MockField label="Nickname">
        <HintBubble variant="success">Nice — that name is free!</HintBubble>
      </MockField>
    </div>

    <div className="flex flex-wrap justify-center gap-x-56 gap-y-24">
      <MockField label="right">
        <HintBubble variant="info">placement="right"</HintBubble>
      </MockField>
      <MockField label="top">
        <HintBubble variant="info" placement="top">
          placement="top"
        </HintBubble>
      </MockField>
      <MockField label="bottom">
        <HintBubble variant="info" placement="bottom">
          placement="bottom"
        </HintBubble>
      </MockField>
      <MockField label="left">
        <HintBubble variant="info" placement="left">
          placement="left"
        </HintBubble>
      </MockField>
    </div>
  </div>
)

// The room list: a grid, like the real lobby. RoomCard sets no width of its own,
// so the grid is what makes every card match — nothing is hand-sized here. The
// long name and the 2- vs 4-seat rows prove the cards still come out equal.
// One room deliberately carries NO `game`, since a single-game lobby passes none
// and the card must still look right without it.
const ROOMS = [
  { name: "Dara's Room", game: 'Teang Len', betCoin: 5000, maxPlayers: 4, players: [{ name: 'Dara' }, { name: 'Sophea' }] },
  { name: 'High Rollers', game: 'Kanteal', betCoin: 10000, maxPlayers: 2, players: [{ name: 'Rith' }, { name: 'Vichea' }] },
  { name: 'Sophea’s Very Long Room Name', game: 'Kanteal', betCoin: 1000, maxPlayers: 4, players: [{ name: 'Sophea' }] },
  { name: 'Beginners', betCoin: 2000, maxPlayers: 3, players: [] },
]

const RoomCardPreview = () => (
  <div className="grid grid-cols-3 gap-4">
    {ROOMS.map((room) => (
      <RoomCard key={room.name} {...room} onJoin={() => { }} />
    ))}
  </div>
)

// Two seat counts side by side, because Table has TWO layouts: 4 or fewer uses the
// hand-tuned corners, more than 4 falls to the computed ellipse. Both need to be
// visible in the gallery or a change to one silently breaks the other.
const TABLE_SEATS = (n) =>
  Array.from({ length: n }, (_, i) => ({
    name: ['You', 'Sophea', 'Dara', 'Rith', 'Chan', 'Mony', 'Vichea', 'Bopha'][i],
    coin: 1000 + i * 640,
    host: i === 0,
  }))

const TablePreview = () => (
  <div className="flex flex-col gap-6">
    {[4, 8].map((n) => (
      <div key={n}>
        <p className="mb-2 font-display text-sm text-white/70 [--stroke-width:0]">
          {n} seats — {n > 4 ? 'computed ring' : 'hand-tuned corners'}
        </p>
        <Table players={TABLE_SEATS(n)} currentTurn={1} />
      </div>
    ))}
  </div>
)

// Sets no width of its own, so the preview supplies the column a sidebar would.
// Shown next to the empty state, since a friends list starts out empty.
const FRIENDS = [
  { id: 1, name: 'Sophea', status: 'online' },
  { id: 2, name: 'Dara', status: 'playing' },
  { id: 3, name: 'Rith', status: 'online' },
  { id: 4, name: 'Vichea', status: 'offline' },
  { id: 5, name: 'Chantrea Longname', status: 'online' },
  { id: 6, name: 'Bopha', status: 'offline' },
]

const FriendListPreview = () => (
  <div className="flex flex-wrap items-start justify-center gap-6">
    <div className="w-80">
      <FriendList friends={FRIENDS} onAction={(name) => console.log('invite', name)} />
    </div>
    <div className="w-80">
      <FriendList friends={[]} />
    </div>
  </div>
)

// Modal is controlled, so the preview owns the open state. Content goes in bare —
// the Modal is already the panel.
const ModalPreview = () => {
  const [open, setOpen] = useState(null)
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Button variant="red" onClick={() => setOpen('confirm')}>
        Leave Room
      </Button>
      <Button variant="blue" onClick={() => setOpen('glass')}>
        Glass
      </Button>
      <Button variant="lime" onClick={() => setOpen('long')}>
        Tall content
      </Button>

      <Modal open={open === 'confirm'} title="Leave room?" size="sm" onClose={() => setOpen(null)}>
        <p className="mb-6 text-center font-display text-base text-white/90 [--stroke-width:0]">
          Your stake stays on the table. Are you sure?
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="blue" size="sm" onClick={() => setOpen(null)}>
            Stay
          </Button>
          <Button variant="red" size="sm" onClick={() => setOpen(null)}>
            Leave
          </Button>
        </div>
      </Modal>

      <Modal open={open === 'glass'} title="Frosted" variant="glass" onClose={() => setOpen(null)}>
        <p className="text-center font-display text-base text-white/90 [--stroke-width:0]">
          Same shell, Card’s glass skin — for panels over live gameplay.
        </p>
      </Modal>

      {/* Taller than the viewport: the overlay scrolls and the top stays reachable */}
      <Modal open={open === 'long'} heading="Rules" size="lg" onClose={() => setOpen(null)} deco>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 14 }, (_, i) => (
            <p key={i} className="font-display text-sm text-white/85 [--stroke-width:0]">
              {i + 1}. Every player is dealt a hand and plays in turn order.
            </p>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// A sample hand in Teang Len's rank order (3 low → 2 high).
const HAND = [
  { rank: '3', suit: 'spades' },
  { rank: '7', suit: 'hearts' },
  { rank: '9', suit: 'clubs' },
  { rank: '10', suit: 'diamonds' },
  { rank: 'J', suit: 'hearts' },
  { rank: 'K', suit: 'spades' },
  { rank: 'A', suit: 'diamonds' },
  { rank: '2', suit: 'hearts' },
]

const PlayingCardPreview = () => {
  // Multi-select, because a shedding game plays combos, not single cards.
  const [picked, setPicked] = useState(() => new Set(['J-hearts']))
  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col items-center gap-10">
      {/* All four suits + the back */}
      <div className="flex items-end gap-3">
        <PlayingCard rank="A" suit="spades" />
        <PlayingCard rank="Q" suit="hearts" />
        <PlayingCard rank="7" suit="diamonds" />
        <PlayingCard rank="10" suit="clubs" />
        <PlayingCard faceDown />
      </div>

      {/* Sizes */}
      <div className="flex items-end gap-3">
        <PlayingCard rank="2" suit="hearts" size="sm" />
        <PlayingCard rank="2" suit="hearts" size="md" />
        <PlayingCard rank="2" suit="hearts" size="lg" />
        <PlayingCard faceDown size="sm" />
        <PlayingCard faceDown size="lg" />
      </div>

      {/* States */}
      <div className="flex items-end gap-3">
        <PlayingCard rank="K" suit="spades" onClick={() => { }} />
        <PlayingCard rank="K" suit="hearts" selected onClick={() => { }} />
        <PlayingCard rank="4" suit="clubs" disabled onClick={() => { }} />
      </div>

      {/* Click to lift — the real interaction. Overlapped like a held hand. */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex -space-x-5">
          {HAND.map(({ rank, suit }) => {
            const id = `${rank}-${suit}`
            return (
              <PlayingCard
                key={id}
                rank={rank}
                suit={suit}
                size="lg"
                selected={picked.has(id)}
                onClick={() => toggle(id)}
              />
            )
          })}
        </div>
        <span className="font-display text-sm text-white/70 [--stroke-width:0]">
          {picked.size === 0 ? 'Tap cards to lift them' : `${picked.size} card${picked.size > 1 ? 's' : ''} selected`}
        </span>
      </div>
    </div>
  )
}

// A dealt Teang Len hand: 13 cards, sorted in the game's rank order (3 low → 2
// high). This is the real load the fan has to survive.
const DEALT = [
  { rank: '3', suit: 'spades' },
  { rank: '4', suit: 'hearts' },
  { rank: '5', suit: 'clubs' },
  { rank: '7', suit: 'diamonds' },
  { rank: '8', suit: 'spades' },
  { rank: '9', suit: 'hearts' },
  { rank: '10', suit: 'clubs' },
  { rank: 'J', suit: 'diamonds' },
  { rank: 'Q', suit: 'spades' },
  { rank: 'K', suit: 'hearts' },
  { rank: 'K', suit: 'clubs' },
  { rank: 'A', suit: 'diamonds' },
  { rank: '2', suit: 'hearts' },
]

const OPPONENT = Array.from({ length: 9 }, (_, i) => ({ id: `back-${i}`, rank: '3', suit: 'spades' }))

const HandPreview = () => {
  const [picked, setPicked] = useState([])
  // meta.expand is Hand's auto-complete phase; this demo has no suggester, so it
  // drops that call rather than re-toggling the card the press just lifted.
  const toggle = (id, meta) =>
    !meta?.expand && setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Stand in for the game's rules: pretend nothing under a 7 can beat the trick.
  const [guard, setGuard] = useState(false)
  const dead = guard ? DEALT.filter((c) => ['3', '4', '5'].includes(c.rank)).map((c) => `${c.rank}-${c.suit}`) : []

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Opponent — same component, backs, tighter */}
      <div className="flex flex-col items-center">
        <span className="font-display text-sm text-white/60 [--stroke-width:0]">Opponent — faceDown</span>
        <Hand cards={OPPONENT} faceDown size="sm" maxWidth={220} />
      </div>

      {/* Your hand — 13 cards, click to lift */}
      <div className="flex flex-col items-center gap-2">
        <Hand
          cards={DEALT}
          size="lg"
          selected={picked}
          disabledIds={dead}
          onSelect={toggle}
          maxWidth={560}
        />
        <div className="flex items-center gap-3">
          <span className="min-w-36 font-display text-sm text-white/70 [--stroke-width:0]">
            {picked.length === 0 ? 'Tap cards to lift them' : `${picked.length} selected`}
          </span>
          <Button size="sm" variant="green" disabled={picked.length === 0} onClick={() => setPicked([])}>
            Play
          </Button>
          <Button size="sm" variant="blue" onClick={() => setGuard((g) => !g)}>
            {guard ? 'Rules off' : 'Rules on'}
          </Button>
        </div>
      </div>

      {/* Flatter vs rounder fan — spread/curve are the whole feel of it */}
      <div className="flex flex-wrap items-end justify-center gap-6">
        <div className="flex flex-col items-center">
          <span className="font-display text-sm text-white/60 [--stroke-width:0]">spread=0 curve=0 (row)</span>
          <Hand cards={DEALT.slice(0, 6)} spread={0} curve={0} />
        </div>
        <div className="flex flex-col items-center">
          <span className="font-display text-sm text-white/60 [--stroke-width:0]">spread=7 curve=2</span>
          <Hand cards={DEALT.slice(0, 6)} spread={7} curve={2} />
        </div>
      </div>
    </div>
  )
}

// Teang Len combos: a single, a pair, a straight. The pile is whatever came before.
const PAIR = [
  { rank: '9', suit: 'hearts' },
  { rank: '9', suit: 'spades' },
]
const STRAIGHT = [
  { rank: '5', suit: 'clubs' },
  { rank: '6', suit: 'diamonds' },
  { rank: '7', suit: 'hearts' },
  { rank: '8', suit: 'spades' },
]
// The play each live combo BEAT — same type and count, one rank lower, which is
// what a real beat looks like. TrickPile draws all of it behind the live cards.
const BEATEN_PAIR = [
  { rank: '7', suit: 'clubs' },
  { rank: '7', suit: 'diamonds' },
]
const BEATEN_STRAIGHT = [
  { rank: '4', suit: 'clubs' },
  { rank: '5', suit: 'diamonds' },
  { rank: '6', suit: 'hearts' },
  { rank: '7', suit: 'spades' },
]

const TrickPilePreview = () => (
  <div className="flex flex-col items-center gap-10">
    {/* The full table scene: trick pile in the centre (small, so it doesn't
        crowd the hand), the local player's 13-card fan along the front rim the
        You seat freed up, and the active opponent ringed by the turn timer. */}
    <Table currentTurn={2} turnSeconds={20} hand={<Hand cards={DEALT} size="md" />}>
      <TrickPile cards={PAIR} pile={BEATEN_PAIR} size="sm" />
    </Table>

    <div className="flex flex-wrap items-center justify-center gap-12">
      <div className="flex flex-col items-center gap-2">
        <TrickPile cards={[]} />
        <span className="font-display text-xs text-white/60 [--stroke-width:0]">empty — you lead</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <TrickPile cards={[{ rank: '2', suit: 'hearts' }]} />
        <span className="font-display text-xs text-white/60 [--stroke-width:0]">single</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <TrickPile cards={PAIR} />
        <span className="font-display text-xs text-white/60 [--stroke-width:0]">pair</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <TrickPile cards={STRAIGHT} />
        <span className="font-display text-xs text-white/60 [--stroke-width:0]">straight</span>
      </div>
    </div>

    {/* Pile — the beaten play peeks out behind the live combo */}
    <div className="flex flex-col items-center gap-2">
      <TrickPile cards={STRAIGHT} pile={BEATEN_STRAIGHT} size="lg" />
      <span className="font-display text-xs text-white/60 [--stroke-width:0]">beaten play peeking behind (full combo)</span>
    </div>
  </div>
)

const TurnTimerPreview = () => {
  // Bumping this re-keys the timers, which is how a real turn change re-arms them.
  const [turn, setTurn] = useState(0)
  const [expired, setExpired] = useState(null)

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Live — 10s so you don't have to wait around */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-8">
          <TurnTimer key={`bare-${turn}`} seconds={10} onExpire={() => setExpired(Date.now())} />
          <TurnTimer key={`face-${turn}`} seconds={10}>
            <Avatar name="Dara" size="sm" />
          </TurnTimer>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="green"
            onClick={() => {
              setTurn((t) => t + 1)
              setExpired(null)
            }}
          >
            Next turn
          </Button>
          <span className="min-w-40 font-display text-sm text-white/70 [--stroke-width:0]">
            {expired ? 'onExpire fired — auto-pass' : 'goes red under 5s'}
          </span>
        </div>
      </div>

      {/* Sizes + the parked state */}
      <div className="flex flex-wrap items-center justify-center gap-8">
        {['sm', 'md', 'lg'].map((sz) => (
          <div key={sz} className="flex flex-col items-center gap-2">
            <TurnTimer key={`${sz}-${turn}`} size={sz} seconds={30} />
            <span className="font-display text-xs text-white/60 [--stroke-width:0]">{sz}</span>
          </div>
        ))}
        <div className="flex flex-col items-center gap-2">
          <TurnTimer seconds={20} running={false}>
            <Avatar name="Sophea" size="sm" />
          </TurnTimer>
          <span className="font-display text-xs text-white/60 [--stroke-width:0]">running=false</span>
        </div>
      </div>
    </div>
  )
}

// A stand-in photo as a data URI — no network, so the preview can't break offline.
const FAKE_PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%236C4FA8'/%3E%3Ccircle cx='40' cy='29' r='15' fill='%23F3D9B1'/%3E%3Cellipse cx='40' cy='74' rx='26' ry='24' fill='%23F3D9B1'/%3E%3C/svg%3E"

// CoinIcon is em-sized, so the point of the preview is that ONE component tracks
// the surrounding font — show it riding along a range of text sizes, then inline
// in a sentence the way balances actually use it.
const CoinIconPreview = () => (
  <div className="flex flex-col items-center gap-8">
    <div className="flex items-end gap-6">
      {[
        ['text-sm', 'Table / Shop total'],
        ['text-lg', 'Profile / Slider'],
        ['text-2xl', 'Header / RoomCard'],
        ['text-4xl', 'Shop pack'],
      ].map(([sz, where]) => (
        <div key={sz} className="flex flex-col items-center gap-2">
          <span className={`font-display text-[#FFD27A] [--stroke-color:#7A4A10] ${sz}`}>
            <CoinIcon /> 12,450
          </span>
          <span className="font-display text-xs text-white/60 [--stroke-width:0]">{where}</span>
        </div>
      ))}
    </div>
    <p className="font-display text-lg text-white [--stroke-color:#0F3358]">
      Balance: <CoinIcon /> 1,250 — it sits on the text baseline like the emoji it replaced.
    </p>
  </div>
)

const AvatarPreview = () => (
  <div className="flex flex-col items-center gap-8">
    {/* Sizes — the three the app actually uses */}
    <div className="flex items-end gap-6">
      {[
        ['sm', 'RoomCard / FriendList'],
        ['md', 'Table seats'],
        ['lg', 'Header'],
      ].map(([sz, where]) => (
        <div key={sz} className="flex flex-col items-center gap-2">
          <Avatar name="Dara" size={sz} />
          <span className="font-display text-xs text-white/60 [--stroke-width:0]">
            {sz} — {where}
          </span>
        </div>
      ))}
    </div>

    {/* Status dots + the active ring */}
    <div className="flex items-end gap-6">
      {['online', 'playing', 'offline'].map((st) => (
        <div key={st} className="flex flex-col items-center gap-2">
          <Avatar name={st} size="md" status={st} />
          <span className="font-display text-xs text-white/60 [--stroke-width:0]">{st}</span>
        </div>
      ))}
      <div className="flex flex-col items-center gap-2">
        <Avatar name="Sophea" size="md" active />
        <span className="font-display text-xs text-white/60 [--stroke-width:0]">active</span>
      </div>
    </div>

    {/* Photo — the white mat keeps the gold frame visible */}
    <div className="flex items-end gap-6">
      <Avatar name="Photo" size="lg" src={FAKE_PHOTO} />
      <Avatar name="Photo" size="md" src={FAKE_PHOTO} status="online" />
      <Avatar name="Photo" size="sm" src={FAKE_PHOTO} />
    </div>
  </div>
)

// Same four players, two outcomes — the `you` flag is what moves.
const STANDINGS_WON = [
  { id: 2, name: 'Sophea', place: 3, coin: -5000 },
  { id: 1, name: 'You', place: 1, coin: 15000, you: true },
  { id: 4, name: 'Vichea', place: 4, coin: -5000 },
  { id: 3, name: 'Rith', place: 2, coin: -5000 },
]
const STANDINGS_LOST = [
  { id: 1, name: 'Dara', place: 1, coin: 15000 },
  { id: 2, name: 'You', place: 3, coin: -5000, you: true },
  { id: 3, name: 'Rith', place: 2, coin: 0 },
  { id: 4, name: 'Chantrea Longname', place: 4, coin: -10000 },
]

const ResultModalPreview = () => {
  const [open, setOpen] = useState(null)
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Button variant="green" onClick={() => setOpen('won')}>
        You win
      </Button>
      <Button variant="red" onClick={() => setOpen('lost')}>
        You lose
      </Button>

      {/* Deliberately no onClose — the only ways out are the two buttons */}
      <ResultModal
        open={open === 'won'}
        players={STANDINGS_WON}
        onRematch={() => setOpen(null)}
        onLeave={() => setOpen(null)}
      />
      <ResultModal
        open={open === 'lost'}
        players={STANDINGS_LOST}
        onRematch={() => setOpen(null)}
        onLeave={() => setOpen(null)}
      />
    </div>
  )
}

// Seeded so the preview opens with a run to show grouping (Dara's two lines share
// one avatar) and a system line. `you` marks the local player.
const SEED_CHAT = [
  { id: 1, system: true, text: 'Sophea joined the room' },
  { id: 2, name: 'Sophea', text: 'hi everyone 👋' },
  { id: 3, name: 'Dara', text: 'ready when you are' },
  { id: 4, name: 'Dara', text: 'who deals?' },
  { id: 5, name: 'You', text: 'me — dealing now', you: true },
  { id: 6, system: true, text: 'Rith joined the room' },
  { id: 7, name: 'Rith', text: 'sorry im late, deal me in' },
]

const ChatPreview = () => {
  const [messages, setMessages] = useState(SEED_CHAT)
  const [empty, setEmpty] = useState([])

  return (
    <div className="flex flex-wrap items-start justify-center gap-6">
      <div className="w-80">
        <Chat
          messages={messages}
          onSend={(text) => setMessages((m) => [...m, { id: Date.now(), name: 'You', text, you: true }])}
        />
      </div>
      <div className="w-80">
        <Chat
          title="Empty"
          messages={empty}
          onSend={(text) => setEmpty((m) => [...m, { id: Date.now(), name: 'You', text, you: true }])}
        />
      </div>
    </div>
  )
}

// The whole point, wired up: pick an emoji, it pops over your seat (bottom) and
// clears itself. `emote` is { id, emoji } so sending the same one twice re-pops.
const TABLE_PLAYERS = [
  { name: 'You', coin: 1250, host: true },
  { name: 'Sophea', coin: 980 },
  { name: 'Dara', coin: 3400 },
  { name: 'Rith', coin: 210 },
]

const EmoteBarPreview = () => {
  const [emotes, setEmotes] = useState({})
  const send = (seat, emoji) => setEmotes((e) => ({ ...e, [seat]: { id: Date.now(), emoji } }))

  return (
    <div className="flex flex-col items-center gap-5">
      <Table currentTurn={0} players={TABLE_PLAYERS.map((p, i) => ({ ...p, emote: emotes[i] }))} />

      <div className="flex flex-col items-center gap-3">
        <EmoteBar onPick={(emoji) => send(0, emoji)} />
        <div className="flex items-center gap-3">
          <span className="font-display text-xs text-white/60 [--stroke-width:0]">
            collapsed by default · 2s cooldown
          </span>
          <Button size="sm" variant="blue" onClick={() => send(1 + Math.floor(Math.random() * 3), '😂')}>
            Opponent emotes
          </Button>
        </div>
      </div>

      {/* Pinned open — for a lobby, where there's room */}
      <div className="flex flex-col items-center gap-2">
        <EmoteBar open onPick={(emoji) => send(0, emoji)} />
        <span className="font-display text-xs text-white/60 [--stroke-width:0]">open — no toggle</span>
      </div>
    </div>
  )
}

const EmoteBubblePreview = () => {
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-end gap-12">
        {/* relative wrapper is the contract — the bubble pins itself above */}
        <div className="relative">
          <Avatar name="Dara" size="md" />
          <EmoteBubble emote={a} />
        </div>
        <div className="relative">
          <Avatar name="Sophea" size="sm" />
          <EmoteBubble emote={b} size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" variant="green" onClick={() => setA({ id: Date.now(), emoji: '👍' })}>
          Send 👍
        </Button>
        <Button size="sm" variant="lime" onClick={() => setB({ id: Date.now(), emoji: '🎉' })}>
          Send 🎉 (sm)
        </Button>
      </div>
      <span className="max-w-80 text-center font-display text-xs leading-relaxed text-white/60 [--stroke-width:0]">
        Press the same button twice — a fresh id re-pops it. A bare emoji string wouldn’t change, so the repeat would do
        nothing.
      </span>
    </div>
  )
}

const ME = { name: 'Sophea', coin: 12450, played: 42, won: 28 }

// Header reports the tap; the page owns the modal — the same split as Footer's
// menu. Log out lives in Profile now, so tapping through to it is the only route
// out, which is why the panel has to be a real target.
const HeaderPreview = () => {
  const [open, setOpen] = useState(false)
  return (
    <div className="w-full self-start">
      <Header username={ME.name} coin={ME.coin} onProfile={() => setOpen(true)} />
      <p className="pt-6 text-center font-display text-sm text-white/40 [--stroke-width:0]">
        tap the blue panel — avatar, name or coins
      </p>
      <Modal open={open} size="sm" onClose={() => setOpen(false)}>
        <Profile bare {...ME} onLogout={() => setOpen(false)} onEditAvatar={() => console.log('edit avatar')} />
      </Modal>
    </div>
  )
}

// Purchases are async, so the preview fakes a checkout: busyId locks the grid
// while one is in flight, which is the state most likely to be got wrong.
const ShopPreview = () => {
  const [busyId, setBusyId] = useState(null)

  function buy(pack) {
    setBusyId(pack.id)
    setTimeout(() => setBusyId(null), 1200)
  }

  return (
    <div className="flex flex-wrap items-start justify-center gap-6">
      <div className="w-96">
        <Shop balance={ME.coin} busyId={busyId} onBuy={buy} onWatchAd={buy} />
      </div>
      {/* Store config can come back empty — say so rather than render a void */}
      <div className="w-96">
        <Shop title="Sold out" packs={[]} balance={0} />
      </div>
    </div>
  )
}

const ProfilePreview = () => (
  <div className="flex flex-wrap items-start justify-center gap-6">
    <div className="w-80">
      <Profile {...ME} onLogout={() => console.log('logout')} onEditAvatar={() => console.log('edit')} />
    </div>
    {/* A fresh account: 0/0 must not divide by zero, and a long name must not
        stretch the panel. No onLogout/onEditAvatar — both affordances vanish. */}
    <div className="w-80">
      <Profile name="Chantrea Longnameverylong" coin={0} played={0} won={0} />
    </div>
  </div>
)

// Stands in for the real HomePage — it owns the menu AND what each item opens,
// so the bar never has to import a screen. This is the pattern to copy:
//
//   const menu = [{ id: 'friend', icon: <img src={friendIcon} alt="" />,
//                   label: 'Friend', onClick: () => setOpen('friend') }, …]
//
//   <Footer items={menu} onPlay={…} />
//   <Modal open={open === 'friend'} onClose={() => setOpen(null)}>
//     <FriendList bare />
//   </Modal>
//
// `bare` matters: Modal already renders a Card, so a FriendList carrying its own
// would stack two blue panels.
const FooterPreview = () => {
  const [openMenu, setOpenMenu] = useState(null)

  // Built in-render because each onClick closes over setOpenMenu. Three items —
  // rebuilding them per render costs nothing.
  const menu = [
    { id: 'friend', icon: <img src={friendIcon} alt="" />, label: 'Friend', onClick: () => setOpenMenu('friend') },
    { id: 'profile', icon: <img src={profileIcon} alt="" />, label: 'Profile', onClick: () => setOpenMenu('profile') },
    { id: 'shop', icon: <img src={shopIcon} alt="" />, label: 'Shop', onClick: () => setOpenMenu('shop') },
  ]

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-10">
      {/* Docked, the way it ships — the parent owns the positioning */}
      <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/10">
        <span className="absolute top-4 left-1/2 -translate-x-1/2 font-display text-sm text-white/40 [--stroke-width:0]">
          tap Friend or Profile — each item's onClick opens its modal
        </span>
        <Footer className="absolute bottom-0" items={menu} onPlay={() => console.log('play')} />
      </div>

      {/* Portalled to <body>, so it escapes the overflow-hidden box above */}
      <Modal open={openMenu === 'friend'} onClose={() => setOpenMenu(null)}>
        <FriendList bare friends={FRIENDS} onAction={(name) => console.log('invite', name)} />
      </Modal>

      <Modal open={openMenu === 'profile'} size="sm" onClose={() => setOpenMenu(null)}>
        <Profile bare {...ME} onLogout={() => setOpenMenu(null)} onEditAvatar={() => console.log('edit avatar')} />
      </Modal>

      <Modal open={openMenu === 'shop'} onClose={() => setOpenMenu(null)}>
        <Shop bare balance={ME.coin} onBuy={(pack) => console.log('buy', pack.id)} />
      </Modal>

      {/* No items — the default. A bar with just PLAY is a real screen. */}
      <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10">
        <span className="absolute top-4 left-1/2 -translate-x-1/2 font-display text-sm text-white/40 [--stroke-width:0]">
          no items — PLAY on its own
        </span>
        <Footer className="absolute bottom-0" onPlay={() => { }} />
      </div>
    </div>
  )
}

// The landing screen, wired the way a real page would: HomePage owns the menu AND
// what each item opens. The bar reports a tap; the page opens the modal — the same
// split HeaderPreview / FooterPreview use. Ships with the co-located background art.
const HomePagePreview = () => {
  const [open, setOpen] = useState(null)
  // The home content is controlled here, not inside HomePage — the page stays a
  // presentational shell with a children slot, and the mode pick / claim state live
  // where a store (Q2) would later drive them.
  const [mode, setMode] = useState('online')
  const [claimed, setClaimed] = useState(false)

  // Built in-render so each onClick closes over setOpen — cheap for three items.
  const menu = [
    { id: 'friend', icon: <img src={friendIcon} alt="" />, label: 'Friend', onClick: () => setOpen('friend') },
    { id: 'profile', icon: <img src={profileIcon} alt="" />, label: 'Profile', onClick: () => setOpen('profile') },
    { id: 'shop', icon: <img src={shopIcon} alt="" />, label: 'Shop', onClick: () => setOpen('shop') },
  ]

  return (
    <>
      <HomePage
        username={ME.name}
        coin={ME.coin}
        items={menu}
        onProfile={() => setOpen('profile')}
        onPlay={() => console.log('play')}
        onLoklak={() => setOpen('loklak')}
        onSetting={() => setOpen('setting')}
      >
        {/* Home content — DailyBonus over the mode picker. The children slot is the
            page's free content area (see HomePage's <main>). */}
        {/* max-w-sm matches DailyBonus's own cap, so both panels stretch to the
            same width (SelectMode has no cap of its own) instead of mismatching. */}
        <div className="flex w-full max-w-sm flex-col gap-10">
          <SelectMode value={mode} onSelect={setMode} />
          <DailyBonus
            value={4}
            max={7}
            color="green"
            progressLabel="4/7 days"
            claimed={claimed}
            onClaim={false}
          />
        </div>
      </HomePage>

      {/* Modals are portalled to <body>, so they escape the page and its overflow. */}
      <Modal open={open === 'friend'} onClose={() => setOpen(null)}>
        <FriendList bare friends={FRIENDS} onAction={(name) => console.log('invite', name)} />
      </Modal>

      <Modal open={open === 'profile'} size="sm" onClose={() => setOpen(null)}>
        <Profile bare {...ME} onLogout={() => setOpen(null)} onEditAvatar={() => console.log('edit avatar')} />
      </Modal>

      <Modal open={open === 'shop'} onClose={() => setOpen(null)}>
        <Shop bare balance={ME.coin} onBuy={(pack) => console.log('buy', pack.id)} />
      </Modal>

      {/* loklak + settings stand-ins — swap in the real panels when they exist */}
      <Modal open={open === 'loklak'} title="Loklak" size="sm" onClose={() => setOpen(null)}>
        <p className="text-center font-display text-base text-white/90 [--stroke-width:0]">Loklak panel goes here.</p>
      </Modal>

      <Modal open={open === 'setting'} title="Settings" size="sm" onClose={() => setOpen(null)}>
        <p className="text-center font-display text-base text-white/90 [--stroke-width:0]">Settings panel goes here.</p>
      </Modal>
    </>
  )
}

// The lobby, wired like a real page: RoomPage owns the room list + handlers and
// lays them on the glass. A longer list than the RoomCard preview, to show the
// grid scrolling inside the panel. Ships over the home background so the glass
// actually frosts.
const LOBBY_ROOMS = [
  { id: 'r1', name: "Dara's Room", betCoin: 5000, maxPlayers: 4, players: [{ name: 'Dara' }, { name: 'Sophea' }] },
  { id: 'r2', name: 'High Rollers', betCoin: 10000, maxPlayers: 2, players: [{ name: 'Rith' }, { name: 'Vichea' }] },
  { id: 'r3', name: 'Sophea’s Very Long Room Name', betCoin: 1000, maxPlayers: 4, players: [{ name: 'Sophea' }] },
  { id: 'r4', name: 'Beginners', betCoin: 2000, maxPlayers: 3, players: [] },
  { id: 'r5', name: 'Night Owls', betCoin: 7500, maxPlayers: 4, players: [{ name: 'Rith' }] },
  { id: 'r6', name: 'Quick Draw', betCoin: 3000, maxPlayers: 2, players: [{ name: 'Vichea' }] },
  { id: 'r7', name: 'Weekend Table', betCoin: 15000, maxPlayers: 4, players: [{ name: 'Dara' }, { name: 'Bopha' }, { name: 'Rith' }] },
]

const RoomPagePreview = () => {
  const [joiningId, setJoiningId] = useState(null)
  const [creating, setCreating] = useState(false)

  // Fake an async join: lock the tapped card's button for a beat.
  const join = (room) => {
    setJoiningId(room.id)
    setTimeout(() => setJoiningId(null), 1200)
  }

  return (
    <>
      <RoomPage
        background={homeBackground}
        username={ME.name}
        coin={ME.coin}
        rooms={LOBBY_ROOMS}
        joiningId={joiningId}
        onJoin={join}
        onProfile={() => console.log('profile')}
        // Create Room reports the tap; the page opens the CreateRoomForm modal.
        onCreate={() => setCreating(true)}
        onBack={() => console.log('back')}
      />

      {/* The lobby's Create Room flow — same Modal + CreateRoomForm the standalone
          CreateRoomForm preview uses (heading art + deco), portalled over the page. */}
      <Modal open={creating} deco onClose={() => setCreating(false)} heading={CREATE_ROOM_HEADING}>
        <CreateRoomForm
          balance={ME.coin}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => {
            console.log('create room', values)
            setCreating(false)
          }}
        />
      </Modal>
    </>
  )
}

// The in-game screen: TablePage hosts the GameTable board under a HUD. Leaving is
// reported, so the page owns the confirm modal — a hand mid-play is real stakes.
const TablePagePreview = () => {
  const [leaving, setLeaving] = useState(false)

  return (
    <>
      <TablePage roomName="Dara's Room" stake={5000} onLeave={() => setLeaving(true)} />

      <Modal open={leaving} title="Leave table?" size="sm" onClose={() => setLeaving(false)}>
        <p className="mb-6 text-center font-display text-base text-white/90 [--stroke-width:0]">
          Your stake stays on the table. Are you sure?
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="blue" size="sm" onClick={() => setLeaving(false)}>
            Stay
          </Button>
          <Button variant="red" size="sm" onClick={() => setLeaving(false)}>
            Leave
          </Button>
        </div>
      </Modal>
    </>
  )
}

// The entry screen: the wordmark + AuthForm over the home background. Fakes an
// async auth so you can see the form's busy lock; the page owns no auth logic —
// that lands in the store (Q2) / API (Q3) above it.
const LoginPagePreview = () => {
  const [busy, setBusy] = useState(false)

  const submit = (values) => {
    console.log('auth', values)
    setBusy(true)
    setTimeout(() => setBusy(false), 1200)
  }

  return <LoginPage background={homeBackground} busy={busy} onSubmit={submit} onModeChange={(m) => console.log('mode', m)} />
}

// `kind` splits the sidebar, and it's the same line AGENTS.md draws:
//   'component' — leaf. Imports nothing outside its folder; copy the folder, done.
//   'block'     — composite. Pulls sibling folders (and sometimes npm packages)
//                 along with it, so copying it out costs more than one folder.
// It's the distinction that decides what a copy-out actually costs, which is why
// it's worth seeing at a glance rather than a cosmetic grouping.
/** @type {{ name: string, kind: 'component' | 'block' | 'page', status: 'wip' | 'done', Component: React.ComponentType, notes?: string }[]} */
export const components = [
  {
    name: 'GameTable',
    kind: 'block',
    status: 'done',
    notes:
      'Playable Teang Len demo — deals four seats and runs the real turn / skip / trick / rank flow from GAME_RULES.md, with three built-in opponents so one person can play the table. Composes Table + Hand + TrickPile + TurnTimer + Button. All rule logic (classify, canBeat, bombs, fulu, bot moves) lives in a pure, unit-tested engine.js; the component is a useReducer over that engine. Opponents are a demo stand-in — the real game is peer-authoritative multiplayer with no bots.',
    Component: GameTable,
  },
  {
    name: 'LoginPage',
    kind: 'page',
    status: 'wip',
    notes:
      'The entry screen — the game wordmark and the AuthForm (Log in / Sign up) centred over the same full-bleed background as HomePage. Presentational: it owns no auth logic. The form reports onSubmit({ mode, username, password }) and onModeChange; `busy` locks the submit while a request is in flight — so the store (Q2) and API (Q3) drop in above without touching it. Props: background, brand, tagline, defaultMode, busy, onSubmit, onModeChange.',
    Component: LoginPagePreview,
  },
  {
    name: 'HomePage',
    kind: 'page',
    status: 'wip',
    notes:
      'The landing screen — Header dashboard on top, full-bleed background art, Footer bar (PLAY + menu + corner tabs) at the bottom, with a free centre slot (children) for the home content. Top-level scene: composes Header + Footer and owns the wiring, so the user data, menu items and tap handlers all come in as props. Background is a real <img> (pass an imported image as `background`); a house gradient stands in until the art is wired.',
    Component: HomePagePreview,
  },
  {
    name: 'RoomPage',
    kind: 'page',
    status: 'wip',
    notes:
      'The lobby — Header on top, then a frosted glass panel listing open rooms as a responsive, scrollable grid of RoomCards, with a title row (Back + Create Room). Top-level scene: composes Header + Card (glass) + Button + RoomCard. The rooms list and every handler come in as props (rooms[], onJoin, onCreate, onBack, joiningId). Sits over the same full-bleed background as HomePage — the art is what the glass frosts (-z-10 + isolate). The grid scrolls inside the panel (min-h-0), so a long lobby stays on one screen.',
    Component: RoomPagePreview,
  },
  {
    name: 'TablePage',
    kind: 'page',
    status: 'wip',
    notes:
      'The in-game screen — a dim backdrop, a slim top HUD (Leave, room name, stake) and the GameTable board centred beneath it. Deliberately thin: all the game logic lives in the GameTable block; this page adds only screen chrome, so the board stays portable and testable on its own (the board/page split RoomPage draws around RoomCard). Leaving is reported via onLeave — the page above opens the confirm modal. Props: background, roomName, stake, onLeave.',
    Component: TablePagePreview,
  },
  {
    name: 'Button',
    kind: 'component',
    status: 'done',
    notes: 'Chunky 3D button — slab pinned under the face for the 3D edge. Props: variant (lime/green/blue/red), size (sm/md/lg/xl), shape (pill/circle/icon), outline (variant/navy), disabled. shape="circle" (round) and shape="icon" (square, rounded corners) are the icon-only forms — pass aria-label.',
    Component: ButtonPreview,
  },
  {
    name: 'DailyBonus',
    kind: 'block',
    status: 'done',
    notes:
      'Reward panel — heading, a line of body copy with an icon to its right (flex row), a progress meter, and an optional Claim button. Composite: Card + ProgressBar + Button. Fully config-driven (every string/icon/amount is a prop) so the same shell serves a login streak, a battle-pass tier, an event goal. `icon` is any node (emoji/img/svg). Props: heading, body, icon, value, max, color, progressLabel, onClaim, claimLabel, claimed.',
    Component: DailyBonusPreview,
  },
  {
    name: 'Badge',
    kind: 'component',
    status: 'done',
    notes:
      'A small glossy label chip — a heading with an optional icon in front. Self-contained, Tailwind-only. Top-lit cartoon gradient in one of four colours keyed to the Button/ProgressBar families. The leading icon (any node — emoji/img/svg) toggles via showIcon, so the same chip serves a titled tag or a plain one. Props: children, color (green/lime/blue/red), size (sm/md/lg), icon, showIcon.',
    Component: BadgePreview,
  },
  {
    name: 'ProgressBar',
    kind: 'component',
    status: 'done',
    notes:
      'A filled track with a count label centred over it (e.g. "10/20"). Self-contained, Tailwind-only, reusable anywhere a fraction shows. Fill is a top-lit cartoon gradient in one of four colours keyed to the Button family; the label rides on the bar with its own shadow so it reads over the track or the fill. Value is clamped so it can\'t overrun. Props: value, max, color (green/lime/blue/red), label (default `${value}/${max}`, or "" for none), showLabel, size (sm/md/lg).',
    Component: ProgressBarPreview,
  },
  {
    name: 'SelectMode',
    kind: 'block',
    status: 'done',
    notes:
      'Game-mode picker — a Card holding a row of options, each an ICON-ONLY Button with its label below (outside the button). Composite: Card + Button. Controlled: caller owns `value` and hears picks via onSelect(id); the chosen mode gets a green button + gold ring + amber label. `icon` is any node (emoji/img/svg). Props: modes[] ({ id, icon, label }), value, onSelect, title.',
    Component: SelectModePreview,
  },
  {
    name: 'Card',
    kind: 'component',
    status: 'done',
    notes: 'Panel surface with two skins: variant "solid" (beveled blue) or "glass" (frosted, backdrop-blur). Takes children. `deco` pins playing-card art along the side borders (moved here from Modal, so any Card can wear it; Modal forwards the prop) — it deals a fresh hand per mount and adds the isolate/-z-10 stacking that sits the cards on the border yet under the content. Props: variant, radius, deco.',
    Component: CardPreview,
  },
  {
    name: 'Header',
    kind: 'block',
    status: 'done',
    notes:
      'Game dashboard header — logo tab, avatar, username/coin bars. Style only (auth/router stripped). The whole blue panel is the profile button: onProfile reports the tap and the PAGE opens the modal (no logout here — that moved to Profile). Renders a <div> when onProfile is absent, so a non-interactive header is not tab-stopped. Composite: Avatar. Props: title, subtitle, username, coin, avatarSrc, onProfile.',
    Component: HeaderPreview,
  },
  {
    name: 'Footer',
    kind: 'block',
    status: 'done',
    notes:
      'Bottom menu bar — PLAY on the left breaking out over the panel\'s top edge, menu on the right (icon over label). Composite: Card + Button. Uses Card\'s `radius` prop for square bottom corners. THE MENU IS THE PAGE\'S: items[] ({ id, icon, label, onClick }) comes in from the caller with its own art — the bar lays out whatever it is given, and defaults to none. Placement is the parent\'s too (pass className="absolute bottom-0"). Props: onPlay, playLabel, playDisabled, items[], onSelect(id).',
    Component: FooterPreview,
  },
  {
    name: 'Table',
    kind: 'block',
    status: 'done',
    notes: 'Card-game table with profile seats around a felt surface. Config-driven: players[], currentTurn, children (table centre). Seats up to 8: four or fewer use hand-tuned corner spots, more than four spread along a computed ellipse that skips the bottom centre (the local hand fan owns the front rim).',
    Component: TablePreview,
  },
  {
    name: 'Kanteal',
    kind: 'block',
    status: 'done',
    notes:
      'Playable Kanteal (កន្ទេល) demo — deals four seats and runs the real cycle / beat / pass / elimination flow, with three bots so one person can play the table. Composes Table + Hand + PlayingCard + Button. All rule logic lives in a pure engine (src/games/kanteal/); `node src/games/kanteal/verify.mjs` checks it section by section against the spec and `analyse.mjs` reports the balance. GAME-BOUND: copying this brings src/games/kanteal/ too.',
    Component: KantealDemo,
  },
  {
    name: 'CreateRoomForm',
    kind: 'block',
    status: 'done',
    notes: 'Create Room form — composes Button + TextField + Slider + SquareToggle. Owns state; reports via onSubmit/onCancel. Pass balance for the affordability guard.',
    Component: CreateRoomFormPreview,
  },
  {
    name: 'AuthForm',
    kind: 'block',
    status: 'done',
    notes: 'Login / Sign-up switcher (Button + TextField). Sign up adds a matching confirm-password field. Owns state; reports via onSubmit({ mode, username, password }) and onModeChange.',
    Component: AuthFormPreview,
  },
  {
    name: 'HintBubble',
    kind: 'component',
    status: 'done',
    notes: 'Cartoon speech bubble for field messages — absolute, like a Chakra tooltip, so it never reflows the form. Give the field a `relative` wrapper. Props: variant (error/info/success), placement (Chakra\'s 12: top/right/bottom/left + -start/-end), icon. Springy pop-in; respects reduced-motion.',
    Component: HintBubblePreview,
  },
  {
    name: 'RoomCard',
    kind: 'block',
    status: 'done',
    notes: 'Lobby room listing — name, stake, player count, seat row, Join. Composite: Card shell + Button. Sets no width of its own: put it in a grid and every card in the loop matches. Props: name, betCoin, maxPlayers, players[], busy, joining, onJoin.',
    Component: RoomCardPreview,
  },
  {
    name: 'ResultModal',
    kind: 'block',
    status: 'done',
    notes:
      'How a match ends — winner, final placements with medals + Avatars, coin deltas, Rematch / Leave. Composite: Modal + Avatar + Button. Deliberately NOT dismissible (no ✕/Escape/backdrop) — it is a decision, not an overlay. Props: open, players[] ({ name, avatarSrc, place, coin, you }), onRematch, onLeave, rematchLabel, leaveLabel, busy.',
    Component: ResultModalPreview,
  },
  {
    name: 'Avatar',
    kind: 'component',
    status: 'done',
    notes:
      'The gold player frame — photo or initial fallback. THE one copy: Header, Table, RoomCard and FriendList all use it. Settled on #00376B (Card/Header/Button ink) + the inset dome after the four pasted copies forked into two different avatars. Props: name, src, size (sm/md/lg), status (online/playing/offline), active.',
    Component: AvatarPreview,
  },
  {
    name: 'CoinIcon',
    kind: 'component',
    status: 'done',
    notes:
      'The currency mark — a drawn gilded coin that replaced the 🪙 emoji everywhere a balance or stake shows (Header, RoomCard, Profile, Table, Shop, Slider, CreateRoomForm). SVG not coin.png: that art is a coin on a baked dark glow, murky inline. Sized in em so one component tracks every font size; gradient ids are per-instance via useId. Palette is the house coin gold (#FFD27A / #7A4A10).',
    Component: CoinIconPreview,
  },
  {
    name: 'TurnTimer',
    kind: 'component',
    status: 'done',
    notes:
      'Countdown ring for the player on turn — wrap a seat avatar (children) or use bare for the digits. Ring drains in pure CSS; only the digits tick, once a second. PASS A CHANGING key PER TURN to re-arm it. Props: seconds, running, warnAt, size (sm/md/lg), onExpire.',
    Component: TurnTimerPreview,
  },
  {
    name: 'TrickPile',
    kind: 'block',
    status: 'done',
    notes:
      "The cards on the table — the combo winning the trick, with the play it beat peeking out behind it. Goes in Table's centre slot. Composite: wraps PlayingCard. Props: cards[], pile[] (only the last is drawn), size (sm/md/lg), emptyText.",
    Component: TrickPilePreview,
  },
  {
    name: 'Hand',
    kind: 'block',
    status: 'done',
    notes:
      'The fan of cards a player holds — arc + adaptive overlap, multi-select to lift a combo. Same component draws an opponent (faceDown). Composite: wraps PlayingCard. Controlled: the game owns selected/disabledIds. Props: cards[], selected[], disabledIds[], onSelect(id), faceDown, size, spread, curve, maxWidth.',
    Component: HandPreview,
  },
  {
    name: 'PlayingCard',
    kind: 'component',
    status: 'done',
    notes:
      'One card from the deck — corner indices, centre pip, striped back. NOT the Card panel. Stateless: the hand owns selected/disabled. Renders a <button> only when onClick is given. Props: rank (2–10/J/Q/K/A), suit (spades/hearts/diamonds/clubs), faceDown, selected, disabled, size (sm/md/lg), onClick.',
    Component: PlayingCardPreview,
  },
  {
    name: 'Modal',
    kind: 'block',
    status: 'done',
    notes:
      'Dimmed backdrop + a Card panel sprung in over it. Composite: Card surface + circle Button to close. Portalled to <body>; closes on ✕ / Escape / backdrop click; locks page scroll. Content goes in BARE — the Modal is the panel. Props: open, title, size (sm/md/lg), variant (solid/glass), closable, onClose.',
    Component: ModalPreview,
  },
  {
    name: 'EmoteBar',
    kind: 'block',
    status: 'done',
    notes:
      'Emote picker — collapsed by default (a table is crowded), pass open to pin it. Built-in cooldown, because emotes are otherwise a spam vector. Composite: wraps Button. Pairs with EmoteBubble. Props: emotes[], onPick(emoji), open, cooldown, disabled.',
    Component: EmoteBarPreview,
  },
  {
    name: 'EmoteBubble',
    kind: 'component',
    status: 'done',
    notes:
      'The emoji that pops over a player profile, then clears itself. Absolute — give the profile a `relative` wrapper (same contract as HintBubble). `emote` is { id, emoji }: a fresh id re-pops it, so sending the same emoji twice works. Table renders one per seat. Props: emote, duration, size (sm/md).',
    Component: EmoteBubblePreview,
  },
  {
    name: 'Chat',
    kind: 'block',
    status: 'done',
    notes:
      'Room message panel — grouped runs, system lines, sticky-bottom scroll that will not yank you out of history. Composite: Card + Avatar + Button + TextField. Caller owns messages[] ({ id, name, text, avatarSrc, you, system }); only the draft is local. Sets no width. Props: messages[], onSend(text), title, placeholder, maxLength, disabled, emptyText.',
    Component: ChatPreview,
  },
  {
    name: 'Shop',
    kind: 'block',
    status: 'done',
    notes:
      'Coin shop — a grid of packs (amount, bonus, price), current balance in the header. Composite: Card + Button. `busyId` locks the whole grid while a checkout is in flight, so two purchases can\'t race into a double charge. onBuy passes the whole pack, not just an id. Sets no width. Pass `bare` to drop the Card when nesting in a Modal. Props: packs[] ({ id, coins, price, bonus, tag, icon }), balance, title, busyId, onBuy(pack), emptyText, bare.',
    Component: ShopPreview,
  },
  {
    name: 'Profile',
    kind: 'block',
    status: 'done',
    notes:
      "The player's own card — avatar, name, balance, and a Played/Won/Win-rate record. Composite: Card + Avatar + Button. Win rate is derived from played/won, never passed. Sets no width. Pass `bare` to drop the Card when nesting in a Modal (which brings its own) — that's how the Footer's Profile menu opens it. Props: name, avatarSrc, coin, played, won, title, onEditAvatar, onLogout, logoutLabel, bare.",
    Component: ProfilePreview,
  },
  {
    name: 'FriendList',
    kind: 'block',
    status: 'done',
    notes:
      'Lobby friends panel — avatar + status dot, online count, per-row invite. Composite: Card shell + Button + Avatar. Sets no width (fills its column); caps at max-h-80 and scrolls. Pass `bare` to drop the Card when nesting inside a Modal (which brings its own). Props: friends[] ({ name, avatarSrc, status: online|playing|offline }), title, actionLabel, onAction, emptyText, bare.',
    Component: FriendListPreview,
  },
  {
    name: 'SquareToggle',
    kind: 'component',
    status: 'done',
    notes: 'Toggle chip for segmented rows. Controlled via `active`; preview is a Max Players group.',
    Component: SquareTogglePreview,
  },
  {
    name: 'TextField',
    kind: 'component',
    status: 'done',
    notes: 'Game-style text input with optional left icon. type="password" adds a show/hide toggle switch. Uncontrolled by default; pass value+onChange to control.',
    Component: TextFieldPreview,
  },
  {
    name: 'Slider',
    kind: 'component',
    status: 'done',
    notes: 'Labeled range slider with live value readout. Self-contained state; onChange(value) reports changes.',
    Component: SliderPreview,
  },
]
