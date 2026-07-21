import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RoomPage from '../components/RoomPage/RoomPage.jsx'
import Modal from '../components/Modal/Modal.jsx'
import CreateRoomForm from '../components/CreateRoomForm/CreateRoomForm.jsx'
import homeBackground from '../components/HomePage/background.webp'
import cardsIcon from '../components/CreateRoomForm/card.webp'
import keysIcon from '../components/CreateRoomForm/keys.webp'
import { useSession, selectUser, selectCoin } from '../state/session'
import { useWallet } from '../query/auth'
import { useRooms, useCreateRoom, useJoinRoom } from '../query/rooms'
import { catalogue } from '../games/index.js'

// The Create Room modal's heading art (same treatment as the workbench preview).
const HEADING_ICON =
  'absolute top-1/2 h-12 w-auto max-w-none -translate-y-1/2 drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)]'
const CREATE_ROOM_HEADING = (
  <span className="relative inline-block">
    <img src={cardsIcon} alt="" className={`${HEADING_ICON} right-full mr-2.5`} />
    CREATE ROOM
    <img src={keysIcon} alt="" className={`${HEADING_ICON} left-full ml-2.5`} />
  </span>
)

// RoomContainer — the lobby wired to the backend.
//
// The room list is a polling query (mapped to RoomCard props via the adapter);
// Create and Join are mutations that charge the wallet server-side and refetch the
// lobby. Both land you in the room's table — that route arrives in the Table slice;
// until then navigating there falls back home.
export default function RoomContainer() {
  const navigate = useNavigate()
  const user = useSession(selectUser)
  const coin = useSession(selectCoin)

  // Keep the header balance honest on entry (create/join also refresh it).
  useWallet()

  const { data: rooms = [], error: listError } = useRooms()
  const createRoom = useCreateRoom()
  const joinRoom = useJoinRoom()

  const [creating, setCreating] = useState(false)

  const displayName = user?.displayName ?? user?.username ?? 'Player'
  // The card whose Join is in flight — locks just that button.
  const joiningId = joinRoom.isPending ? joinRoom.variables : null
  const actionError = joinRoom.error ?? createRoom.error

  function join(room) {
    joinRoom.mutate(room.id, {
      onSuccess: () => navigate(`/table/${room.id}`),
    })
  }

  function submitCreate(values) {
    createRoom.mutate(
      { name: values.roomName, gameId: values.gameId, betCoin: values.betAmount, maxPlayers: values.maxPlayers },
      {
        onSuccess: ({ room }) => {
          setCreating(false)
          navigate(`/table/${room.roomId}`)
        },
      },
    )
  }

  return (
    <>
      <RoomPage
        background={homeBackground}
        username={displayName}
        coin={coin}
        avatarSrc={user?.avatarUrl}
        rooms={rooms}
        joiningId={joiningId}
        onJoin={join}
        onCreate={() => {
          createRoom.reset()
          setCreating(true)
        }}
        onBack={() => navigate('/')}
        emptyText={
          listError ? 'Could not load rooms — is the server running?' : 'No open rooms — create one!'
        }
      />

      {/* A join failure (room filled/started, or funds) shown over the lobby. */}
      {joinRoom.isError && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="rounded-xl bg-red-600/95 px-4 py-2 font-display text-sm text-white shadow-lg [--stroke-width:0]">
            {actionError?.message ?? 'Could not join the room.'}
          </div>
        </div>
      )}

      <Modal open={creating} deco onClose={() => setCreating(false)} heading={CREATE_ROOM_HEADING}>
        {createRoom.isError && (
          <p className="mb-3 rounded-lg bg-red-600/90 px-3 py-2 text-center font-display text-sm text-white [--stroke-width:0]">
            {createRoom.error?.message ?? 'Could not create the room.'}
          </p>
        )}
        <CreateRoomForm
          balance={coin}
          games={catalogue}
          defaultName={displayName}
          creating={createRoom.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={submitCreate}
        />
      </Modal>
    </>
  )
}
