import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Button from '../components/Button/Button.jsx'
import CoinIcon from '../components/CoinIcon/CoinIcon.jsx'
import { useInvites } from '../state/invites'
import { useSession } from '../state/session'
import { useJoinRoom } from '../query/rooms'
import { getSocket } from '../net/socket'
import { SERVER_EVENTS } from '../net/events'
import { router } from './router.jsx'

// Listens for `room:invite` pushes and stacks the live invites into the store.
// Runs while logged in; the shared socket is already connected app-wide.
function useRoomInviteListener() {
  const token = useSession((s) => s.token)
  const addInvite = useInvites((s) => s.addInvite)

  useEffect(() => {
    if (!token) return
    const socket = getSocket()
    socket.on(SERVER_EVENTS.ROOM_INVITE, addInvite)
    return () => socket.off(SERVER_EVENTS.ROOM_INVITE, addInvite)
  }, [token, addInvite])
}

// One invite card. Confirms by running the normal join (authoritative capacity +
// affordability checks) then routing into the table; cancel just dismisses.
function InviteCard({ invite, onClose }) {
  const joinRoom = useJoinRoom()
  const [error, setError] = useState(null)

  function confirm() {
    setError(null)
    joinRoom.mutate(invite.roomId, {
      onSuccess: () => {
        onClose()
        router.navigate(`/table/${invite.roomId}`)
      },
      // A full room / not-enough-coins is a 4xx (not the global modal's job), so
      // show it right on the card and let them dismiss.
      onError: (e) => setError(e?.message ?? 'Could not join the room.'),
    })
  }

  return (
    <motion.div
      layout
      initial={{ x: '-120%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-120%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="pointer-events-auto w-72 rounded-[20px] border-[3px] border-[#00376B] bg-linear-to-b from-[#2A6296] to-[#1B4E86] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.45),inset_0_2px_0_rgba(255,255,255,0.25)]"
    >
      <div className="flex items-start gap-2">
        <span className="text-2xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">📩</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] text-white [--stroke-width:0]">
            <span className="text-[#FFD27A]">{invite.from?.name ?? 'A friend'}</span> invited you to play
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate font-display text-sm text-white/80 [--stroke-width:0]">
            <span className="truncate">{invite.roomName}</span>
            {invite.betCoin > 0 && (
              <span className="shrink-0 text-[#FFD27A]">
                · <CoinIcon /> {invite.betCoin.toLocaleString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-600/90 px-2 py-1 text-center font-display text-xs text-white [--stroke-width:0]">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex justify-end gap-2">
        <Button variant="red" size="sm" outline="navy" disabled={joinRoom.isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="green" size="sm" outline="navy" disabled={joinRoom.isPending} onClick={confirm}>
          {joinRoom.isPending ? 'Joining…' : 'Confirm'}
        </Button>
      </div>
    </motion.div>
  )
}

// Fixed, bottom-left stack of slide-in (left→right) invite cards. Mounted once at
// the app root so an invite pops on whatever screen the user is on.
export default function RoomInviteToast() {
  useRoomInviteListener()
  const invites = useInvites((s) => s.invites)
  const dismiss = useInvites((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex flex-col gap-2">
      <AnimatePresence>
        {invites.map((invite) => (
          <InviteCard key={invite.key} invite={invite} onClose={() => dismiss(invite.key)} />
        ))}
      </AnimatePresence>
    </div>
  )
}
