import { AnimatePresence, motion } from 'motion/react'
import Header from '../Header/Header.jsx'
import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import RoomCard from '../RoomCard/RoomCard.jsx'

// RoomPage — the lobby: the Header dashboard on top, then a frosted glass panel
// filling the screen that lists the open rooms as a responsive grid of RoomCards,
// with a title row (Create Room + a Back tab). Sits over the same full-bleed
// background as HomePage.
//
// TOP-LEVEL SCENE, not a leaf: composes Header + Card + Button + RoomCard. Like
// HomePage it owns the wiring — the room data and every handler come in as props,
// so the page stays presentational. The rooms list is the PAGE'S: pass `rooms`
// and `onJoin`; RoomPage just lays them out on the glass.
//
// GLASS NEEDS A BACKDROP: Card's `glass` skin is translucent + backdrop-blur, so
// it only reads as frosted glass when there's art behind it to blur. That's why
// the background <img> sits under the panel (same -z-10 + `isolate` pairing as
// HomePage — see that file for why isolate is required). Pass `background` to
// override; a house gradient stands in without one, and the glass still frosts it.
//
// SCROLLING: the glass panel grows to fill the space between Header and the screen
// edge; the room grid inside it scrolls (min-h-0 is what lets a flex child scroll
// instead of pushing the panel taller). So a long lobby stays on one screen.

export default function RoomPage({
  background,
  // Header
  title,
  subtitle,
  username,
  coin,
  avatarSrc,
  onProfile,
  // Lobby
  rooms = [],
  onJoin,
  onCreate,
  onBack,
  joiningId, // id of the room currently being joined — locks that card's button
  panelTitle = 'Rooms',
  emptyText = 'No open rooms — create one!',
  className = '',
}) {
  return (
    <div className={`relative isolate flex min-h-dvh w-full flex-col overflow-hidden ${className}`}>
      {/* Full-bleed background the glass frosts. -z-10 keeps it behind the in-flow
          content; the root's `isolate` gives that negative layer a stacking context
          so it doesn't slip behind the whole page (see HomePage for the full note). */}
      {background ? (
        <img src={background} alt="" aria-hidden decoding="sync" className="absolute inset-0 -z-10 size-full object-cover" draggable={false} />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-[#2B7FC9] to-[#0F3358]" />
      )}

      <Header
        title={title}
        subtitle={subtitle}
        username={username}
        coin={coin}
        avatarSrc={avatarSrc}
        onProfile={onProfile}
      />

      {/* The glass panel fills the gap under the Header. min-h-0 on the flex column
          lets the inner grid own the scroll. */}
      <main className="flex min-h-0 flex-1 flex-col px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-4 pb-6">
        <Card variant="glass" className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-5">
          {/* Title row — Back tab (if any), the panel title, and Create Room. */}
          <div className="flex items-center gap-3">
            {onBack && (
              <Button shape="circle" size="sm" variant="blue" outline="navy" aria-label="Back" onClick={onBack}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            )}
            <h2 className="mr-auto font-display text-2xl text-white [--stroke-color:#00376B]">{panelTitle}</h2>
            {onCreate && (
              <Button size="sm" variant="lime" outline="navy" onClick={onCreate}>
                Create Room
              </Button>
            )}
          </div>

          {/* The grid scrolls; min-h-0 + overflow-y-auto keeps it inside the panel
              instead of stretching it. pr-1 leaves room for the scrollbar.
              content-start is what keeps the CARDS at their natural height: a grid
              defaults align-content to stretch, so filling the tall flex-1 panel
              would stretch the row tracks (and the cards with them). Packing rows to
              the top instead leaves the slack as empty scroll space, not tall cards. */}
          {rooms.length === 0 ? (
            <motion.div
              className="flex flex-1 items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <span className="font-display text-base text-white/80 [--stroke-width:0]">{emptyText}</span>
            </motion.div>
          ) : (
            <div className="grid min-h-0 flex-1 content-start grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {/* Cards stagger in on load, and animate in/out as the live lobby
                  changes (rooms open, fill, close over the socket). `layout` lets the
                  remaining cards glide into place when one is added or removed. */}
              <AnimatePresence mode="popLayout">
                {rooms.map((room, i) => {
                  const key = room.id ?? room.name
                  return (
                    <motion.div
                      key={key}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.28, ease: 'easeOut', delay: Math.min(i * 0.05, 0.4) }}
                    >
                      <RoomCard
                        {...room}
                        joining={joiningId != null && key === joiningId}
                        onJoin={() => onJoin?.(room)}
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
