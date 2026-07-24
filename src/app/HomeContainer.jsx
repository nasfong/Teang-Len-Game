import { useState } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import HomePage from '../components/HomePage/HomePage.jsx'
import Modal from '../components/Modal/Modal.jsx'
import Profile from '../components/Profile/Profile.jsx'
import Shop from '../components/Shop/Shop.jsx'
import FriendsModal from './FriendsModal.jsx'
import SelectMode from '../components/SelectMode/SelectMode.jsx'
import DailyBonus from '../components/DailyBonus/DailyBonus.jsx'
import friendIcon from '../assets/icons/friend.webp'
import profileIcon from '../assets/icons/profile.webp'
import shopIcon from '../assets/icons/shop.webp'
import { useSession, selectUser, selectCoin } from '../state/session'
import { useWallet } from '../query/auth'
import { useClaimAdReward } from '../query/rewards'
import { useProducts } from '../query/shop'
import { productToPack } from '../net/adapters'

// Content panels fade up on entry; the parent staggers them so SelectMode leads and
// DailyBonus follows.
//
// Deliberately a short TWEEN over a small distance, NOT a spring over a big slide —
// these are drop-shadowed panels, and on an iOS PWA a spring animating a large `x`
// translate on that subtree overshoots and repaints a wide area every frame, so any
// hitch reads as stutter (the lighter Header/Footer never showed it). A fixed-length
// opacity+`y` tween is deterministic, moves less, and stays GPU-composited. Distance
// is small on purpose: 12px is enough to read as "arriving" without the cost.
const panelIn = {
  hidden: { y: 12, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
}

// HomeContainer — the landing screen wired to the real session.
//
// LIVE data: the Header username + coin come from the global session, and the
// wallet is refetched fresh on mount (useWallet). The Profile modal shows the
// signed-in user and owns Log Out (clears the session → bounces to /login via the
// route guard). PLAY heads to the room lobby (that slice wires /room next).
//
// PRESENTATIONAL for now: Shop, Friends and DailyBonus have no backend endpoints
// yet, so they render with placeholder data — the shells are real, the wiring
// lands when those services exist. The mode picker is local UI state.
export default function HomeContainer() {
  const navigate = useNavigate()
  const user = useSession(selectUser)
  const coin = useSession(selectCoin)
  const signOut = useSession((s) => s.logout)

  // Pull a fresh balance into the session on mount.
  useWallet()
  const claimAd = useClaimAdReward()
  const { data: products = [] } = useProducts()
  const packs = products.map(productToPack)

  // Which footer/profile modal is open (null = none), and the picked play mode.
  const [openModal, setOpenModal] = useState(null)
  const [mode, setMode] = useState('online')
  // The rewarded-video row: whether the (fake) clip is playing, and the result note.
  const [adPlaying, setAdPlaying] = useState(false)
  const [adNote, setAdNote] = useState(null) // { text, ok }

  // Play the (simulated) rewarded video, THEN claim the server-owned reward. The
  // amount + cooldown live on the backend — the client only reports the ad finished.
  function watchAd() {
    if (adPlaying || claimAd.isPending) return
    setAdNote(null)
    setAdPlaying(true)
    setTimeout(() => {
      setAdPlaying(false)
      claimAd.mutate(undefined, {
        onSuccess: ({ reward }) => setAdNote({ text: `🎉 +${reward.toLocaleString()} coins!`, ok: true }),
        onError: (err) => setAdNote({ text: err.message, ok: false }),
      })
    }, 2000)
  }

  const displayName = user?.displayName ?? user?.username ?? 'Player'

  function logout() {
    signOut()
    navigate('/login', { replace: true })
  }

  function play() {
    // Solo is offline (bots); online/with-friends go through the lobby. The room
    // lobby slice wires /room — until then this routes there and lands home.
    navigate('/room', { state: { mode } })
  }

  // Footer menu — each opens its modal.
  const menu = [
    { id: 'friend', icon: <img src={friendIcon} alt="" />, label: 'Friend', onClick: () => setOpenModal('friend') },
    { id: 'profile', icon: <img src={profileIcon} alt="" />, label: 'Profile', onClick: () => setOpenModal('profile') },
    { id: 'shop', icon: <img src={shopIcon} alt="" />, label: 'Shop', onClick: () => setOpenModal('shop') },
  ]

  return (
    <>
      <HomePage
        username={displayName}
        coin={coin}
        avatarSrc={user?.avatarUrl}
        items={menu}
        onProfile={() => setOpenModal('profile')}
        onPlay={play}
        onLoklak={() => setOpenModal('loklak')}
        onSetting={() => setOpenModal('setting')}
      >
        {/* Short landscape (a phone) lays the two panels SIDE BY SIDE to use the
            width; a tall screen (desktop/portrait-tall) keeps the original centred
            column. `items-start` so they top-align when their heights differ. */}
        <motion.div
          className="flex w-full max-w-3xl flex-row items-start justify-center gap-5 tall:max-w-sm tall:flex-col tall:items-stretch tall:gap-10"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.15, delayChildren: 0.25 } } }}
        >
          {/* Each panel fades up, one after the other. transform-gpu keeps the tween
              on its own compositor layer so the slide doesn't repaint the panel. */}
          <motion.div variants={panelIn} className="flex transform-gpu justify-center">
            <SelectMode value={mode} onSelect={setMode} />
          </motion.div>
          <motion.div variants={panelIn} className="flex w-full max-w-sm transform-gpu justify-center">
            <DailyBonus value={4} max={7} color="green" progressLabel="4/7 days" onClaim={false} />
          </motion.div>
        </motion.div>
      </HomePage>

      {/* Profile — real user + Log Out. Stats are stubbed until a records endpoint. */}
      <Modal open={openModal === 'profile'} size="sm" onClose={() => setOpenModal(null)}>
        <Profile
          bare
          name={displayName}
          avatarSrc={user?.avatarUrl}
          coin={coin}
          played={0}
          won={0}
          onLogout={logout}
        />
      </Modal>

      {/* Shop (catalog API) + Friends (search/add/list API). */}
      <Modal open={openModal === 'shop'} onClose={() => { setOpenModal(null); setAdNote(null) }}>
        {adNote && (
          <p
            className={`mb-2 rounded-lg px-3 py-1.5 text-center font-display text-sm [--stroke-width:0] ${
              adNote.ok ? 'bg-black/50 text-[#FFD27A]' : 'bg-red-600/90 text-white'
            }`}
          >
            {adNote.text}
          </p>
        )}
        <Shop
          bare
          balance={coin}
          packs={packs}
          busyId={adPlaying || claimAd.isPending ? 'ad' : undefined}
          onWatchAd={watchAd}
          onBuy={(pack) => console.log('buy', pack.id)}
        />
      </Modal>

      <FriendsModal open={openModal === 'friend'} onClose={() => setOpenModal(null)} />

      <Modal open={openModal === 'loklak'} title="Loklak" size="sm" onClose={() => setOpenModal(null)}>
        <p className="text-center font-display text-base text-white/90 [--stroke-width:0]">Loklak panel goes here.</p>
      </Modal>

      <Modal open={openModal === 'setting'} title="Settings" size="sm" onClose={() => setOpenModal(null)}>
        <p className="text-center font-display text-base text-white/90 [--stroke-width:0]">Settings panel goes here.</p>
      </Modal>
    </>
  )
}
