import { useEffect, useState } from 'react'
import FriendList from '../components/FriendList/FriendList.jsx'
import Modal from '../components/Modal/Modal.jsx'
import Avatar from '../components/Avatar/Avatar.jsx'
import Button from '../components/Button/Button.jsx'
import {
  useAcceptRequest,
  useFriends,
  useRemoveFriend,
  useRemovePending,
  useSendRequest,
  useUserSearch,
} from '../query/friends'
import { useInviteToRoom } from '../query/rooms'

const STATUS_LABEL = { online: 'Online', playing: 'In game', offline: 'Offline' }
const STATUS_TONE = { online: 'text-[#7CE04A]', playing: 'text-[#FFD27A]', offline: 'text-white/55' }

// The popup a friend row opens: their profile, with Remove friend at the bottom.
function FriendProfileModal({ friend, onClose, onRemove, removing }) {
  return (
    <Modal open={Boolean(friend)} size="sm" title="Profile" onClose={onClose}>
      {friend && (
        <div className="flex flex-col items-center gap-3 py-1">
          <Avatar name={friend.name} size="lg" status={friend.status} />
          <span className="w-full truncate text-center font-display text-2xl text-white [--stroke-color:#0F3358]">
            {friend.name}
          </span>
          {friend.username && (
            <span className="font-display text-sm text-white/55 [--stroke-width:0]">@{friend.username}</span>
          )}
          <span className={`font-display text-base [--stroke-width:0] ${STATUS_TONE[friend.status] ?? STATUS_TONE.offline}`}>
            {STATUS_LABEL[friend.status] ?? STATUS_LABEL.offline}
          </span>

          <div className="mt-2 flex justify-center">
            <Button variant="red" size="sm" disabled={removing} onClick={() => onRemove(friend.id)}>
              {removing ? 'Removing…' : 'Remove friend'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Stateful wrapper around the presentational FriendList: owns the search box text,
// debounces it before hitting the API, maps server shapes to the list's props,
// wires the request-flow mutations, and hosts the friend-profile popup. Reused by
// the Home Friends modal and the Table invite popup — pass `roomId` to turn on the
// per-friend Invite action (invite that friend into the room).
export default function FriendsPanel({ roomId, title = 'Friends' }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState(null) // friend whose profile popup is open
  const [invitedIds, setInvitedIds] = useState([]) // friends we've rung into the room

  // Debounce so we don't fire a request on every keystroke. 300ms is the usual
  // sweet spot — long enough to coalesce typing, short enough to feel instant.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(id)
  }, [search])

  const friends = useFriends()
  const results = useUserSearch(debounced)
  const sendRequest = useSendRequest()
  const acceptRequest = useAcceptRequest()
  const removePending = useRemovePending()
  const removeFriend = useRemoveFriend()
  // Always called (hooks can't be conditional); only wired to the UI when roomId is
  // set, so it never fires without a target room.
  const invite = useInviteToRoom(roomId)
  const canInvite = Boolean(roomId)

  const state = friends.data ?? { friends: [], incoming: [], outgoing: [] }
  // displayName → name for every row shape.
  const mapUser = (u) => ({ id: u.id, name: u.displayName, username: u.username, status: u.status })
  const friendRows = (state.friends ?? []).map(mapUser)
  const incomingRows = (state.incoming ?? []).map(mapUser)
  const outgoingRows = (state.outgoing ?? []).map(mapUser)
  const searchRows = (results.data ?? []).map((r) => ({
    id: r.id,
    name: r.displayName,
    username: r.username,
    relation: r.relation,
  }))

  const searchError = results.isError ? 'Search failed. Try again.' : undefined

  // Whichever mutation is in flight, its variables is the userId it's acting on —
  // that's the row that should show a busy control.
  const busyId =
    [sendRequest, acceptRequest, removePending, removeFriend].find((m) => m.isPending)?.variables ?? undefined

  // Keep the open popup in sync with live data (e.g. the friend goes online, or a
  // real-time push removes them) — and close it once removal lands.
  const selectedLive = selected ? (friendRows.find((f) => f.id === selected.id) ?? null) : null
  useEffect(() => {
    if (selected && !selectedLive) setSelected(null)
  }, [selected, selectedLive])

  function inviteFriend(friend) {
    invite.mutate(friend.id, { onSuccess: () => setInvitedIds((ids) => [...ids, friend.id]) })
  }

  return (
    <>
      <FriendList
        bare
        title={title}
        friends={friendRows}
        incoming={incomingRows}
        outgoing={outgoingRows}
        searchValue={search}
        onSearchChange={setSearch}
        searchResults={searchRows}
        // Debounce lag counts as "searching" too, so the spinner shows the moment
        // you type rather than waiting for the request to actually fire.
        searching={results.isFetching || (search.trim() !== '' && search.trim() !== debounced.trim())}
        searchError={searchError}
        onAddFriend={(id) => sendRequest.mutate(id)}
        onAcceptRequest={(id) => acceptRequest.mutate(id)}
        onRemovePending={(id) => removePending.mutate(id)}
        onViewFriend={setSelected}
        busyId={busyId}
        onInviteFriend={canInvite ? inviteFriend : undefined}
        invitedIds={invitedIds}
        invitingId={invite.isPending ? invite.variables : undefined}
      />

      <FriendProfileModal
        friend={selectedLive}
        removing={removeFriend.isPending}
        onClose={() => setSelected(null)}
        onRemove={(id) => removeFriend.mutate(id)}
      />
    </>
  )
}
