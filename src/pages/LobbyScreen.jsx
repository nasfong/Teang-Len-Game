import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RoomPage from '../components/RoomPage/RoomPage.jsx'
import Modal from '../components/Modal/Modal.jsx'
import CreateRoomForm from '../components/CreateRoomForm/CreateRoomForm.jsx'
import homeBackground from '../components/HomePage/background.webp'
import cardsIcon from '../components/CreateRoomForm/card.webp'
import keysIcon from '../components/CreateRoomForm/keys.webp'
import { useSession, selectUser, selectCoin } from '../stores/session'
import { useWallet } from '../api/useAuth'
import { useRooms, useCreateRoom, useJoinRoom } from '../api/useRooms'
import { catalogue } from '../games/index.js'
import { writeSolo } from '../features/table/soloGame.js'
import Notice from '../components/Notice/Notice.jsx'
import { displayName as toDisplayName } from '../utils/user'
import { getPref, setPref } from '../utils/prefs'

// Names for the bot seats in a solo game (seat 0 is the human).
const BOT_NAMES = ['Sophea', 'Dara', 'Rith', 'Chan', 'Mony', 'Vichea', 'Bopha']

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

// LobbyScreen — the /room route: the lobby wired to the backend.
//
// The room list is a polling query (mapped to RoomCard props via the adapter);
// Create and Join are mutations that charge the wallet server-side and refetch the
// lobby. Both land you in the room's table — that route arrives in the Table slice;
// until then navigating there falls back home.
export default function LobbyScreen() {
  const navigate = useNavigate()
  const user = useSession(selectUser)
  const coin = useSession(selectCoin)

  // Keep the header balance honest on entry (create/join also refresh it).
  useWallet()

  const { data: rooms = [], error: listError } = useRooms()
  const createRoom = useCreateRoom()
  const joinRoom = useJoinRoom()

  const [creating, setCreating] = useState(false)

  const displayName = toDisplayName(user)
  // The card whose Join is in flight — locks just that button.
  const joiningId = joinRoom.isPending ? joinRoom.variables : null
  const actionError = joinRoom.error ?? createRoom.error

  function join(room) {
    joinRoom.mutate(room.id, {
      onSuccess: () => navigate(`/table/${room.id}`),
    })
  }

  function submitCreate(values) {
    // Remember the switch: someone practising against bots usually wants bots again
    // next time, and someone hosting real rooms shouldn't have to turn it off twice.
    setPref('withBots', values.withBots)

    // Play with Bots → a client-only game against bots, no server room and no other
    // players (see SoloTableScreen / useSoloChannel). Stash the setup in localStorage
    // and jump to /solo; the human takes seat 0 and bots fill the rest.
    if (values.withBots) {
      const seats = [{ playerId: user?.id, name: displayName }]
      for (let i = 1; i < values.maxPlayers; i++) {
        seats.push({ playerId: `solo-bot-${i}`, name: BOT_NAMES[(i - 1) % BOT_NAMES.length] })
      }
      writeSolo({
        roomId: 'solo',
        config: {
          roomId: 'solo',
          name: values.roomName,
          gameCode: values.gameCode,
          betCoin: values.betAmount,
          maxPlayers: values.maxPlayers,
          seats,
          humanCoin: coin,
        },
        game: null,
      })
      setCreating(false)
      navigate('/solo')
      return
    }
    createRoom.mutate(
      { name: values.roomName, gameCode: values.gameCode, betCoin: values.betAmount, maxPlayers: values.maxPlayers },
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
          <Notice size="lg">{actionError?.message ?? 'Could not join the room.'}</Notice>
        </div>
      )}

      <Modal open={creating} deco onClose={() => setCreating(false)} heading={CREATE_ROOM_HEADING}>
        {createRoom.isError && (
          <Notice className="mb-3">{createRoom.error?.message ?? 'Could not create the room.'}</Notice>
        )}
        <CreateRoomForm
          balance={coin}
          games={catalogue}
          defaultName={displayName}
          // Read here, not inside the form: the modal only mounts while `creating`,
          // so each open picks up the value the last submit stored.
          defaultWithBots={getPref('withBots', false) === true}
          creating={createRoom.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={submitCreate}
        />
      </Modal>
    </>
  )
}
