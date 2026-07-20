import { motion } from 'motion/react'
import Header from '../Header/Header.jsx'
import Footer from '../Footer/Footer.jsx'
// The landing art, co-located so it travels with the folder. It's the DEFAULT
// background; pass `background` to override (a seasonal art, an event splash).
import homeBackground from './background.webp'

// HomePage — the game's landing screen: the Header dashboard across the top, a
// full-bleed illustrated background, and the Footer bar (PLAY + menu + corner
// tabs) pinned to the bottom. The centre is a free `children` slot for whatever
// the page puts on the home screen (a room list, news, a hero art panel).
//
// TOP-LEVEL SCENE, not a leaf: it composes Header + Footer (which themselves pull
// Avatar, Card, Button…). Like GameTable, it's the page that owns the wiring — the
// menu, the profile modal, the routes — so every interactive bit comes in as a
// prop and HomePage stays presentational. THE MENU IS THE PAGE'S (see Footer):
// pass `items` and the tap handlers; HomePage just lays them out.
//
// LAYOUT: a min-h-dvh flex column — Header, a flex-1 content area, then Footer.
// Footer is the last child, so it sits at the bottom with no absolute positioning
// needed (its own corner tabs anchor inside its box and hug its bottom edge). The
// background is a real <img> under everything (Vite hashes the filename, so a
// bg-[url()] class could never name the built path — same reason Table uses an
// <img>). Pass `background` as an imported image; a gradient stands in without one.
//
// PORTABLE: co-locate the background art in this folder and import it where the
// page mounts, then pass it as `background` — same contract as Footer's menu art.

export default function HomePage({
  // Background art (an imported image src). Defaults to the co-located landing art;
  // pass your own to override. Null it out to fall back to the house gradient.
  background = homeBackground,
  // Header
  title,
  subtitle,
  username,
  coin,
  avatarSrc,
  onProfile,
  // Footer
  onPlay,
  playLabel,
  playDisabled,
  items = [],
  onSelect,
  onLoklak,
  onSetting,
  // Centre slot — the home screen's actual content
  children,
  className = '',
}) {
  return (
    <div className={`relative isolate flex min-h-dvh w-full flex-col overflow-hidden ${className}`}>
      {/* Full-bleed background under everything. object-cover fills any aspect
          without distorting. -z-10 pushes it BEHIND the in-flow Header/Footer (an
          absolute element otherwise paints OVER non-positioned siblings) — which is
          why the root needs `isolate`: it gives -z-10 a stacking context to sit in,
          so the image lands behind the page's content and not behind the whole page.
          The gradient fallback keeps the screen from going blank without art. */}
      {background ? (
        <img src={background} alt="" aria-hidden decoding="sync" className="absolute inset-0 -z-10 size-full object-cover" draggable={false} />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-[#2B7FC9] to-[#0F3358]" />
      )}

      {/* Header sits on top of the art at the very top of the column. Slides DOWN
          into place on mount (the root's overflow-hidden clips it while off-screen). */}
      <motion.div
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <Header
          title={title}
          subtitle={subtitle}
          username={username}
          coin={coin}
          avatarSrc={avatarSrc}
          onProfile={onProfile}
        />
      </motion.div>

      {/* Content area — grows to fill the gap between Header and Footer. The page's
          own home content goes here. Empty by default. */}
      {/* min-h-0 + overflow-y-auto so a short landscape viewport scrolls the home
          content instead of clipping it between the Header and Footer bars. */}
      <main className="relative flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] py-2">
        {children}
      </main>

      {/* Footer as the last child → sits at the bottom of the column. No positioning
          class needed: the flex column already parks it there, and its corner tabs
          anchor within its own box. Slides UP into place on mount. */}
      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.08 }}
      >
        <Footer
          onPlay={onPlay}
          playLabel={playLabel}
          playDisabled={playDisabled}
          items={items}
          onSelect={onSelect}
          onLoklak={onLoklak}
          onSetting={onSetting}
        />
      </motion.div>
    </div>
  )
}
