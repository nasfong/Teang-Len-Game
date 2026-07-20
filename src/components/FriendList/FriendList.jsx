import { useState } from 'react'
import Card from '../Card/Card.jsx'
import Button from '../Button/Button.jsx'
import Avatar from '../Avatar/Avatar.jsx'
import TextField from '../TextField/TextField.jsx'

// FriendList — the social panel: two tabs, Friends and Requests. The Friends tab
// has a search box to find and add players; the Requests tab lists incoming
// requests (confirm/decline) and ones you've sent (cancel). Composite (Card +
// Button + Avatar + TextField), so copying it out brings those folders too.
//
// PRESENTATIONAL: it owns only the active-tab UI state. All data + fetching lives
// in the container, which hands us the arrays and the action callbacks:
//   friends / incoming / outgoing : [{ id, name, username?, status }]
//   searchResults                 : [{ id, name, username, relation }]
// relation ∈ 'friend' | 'incoming' | 'outgoing' | 'none'.
//
// SIZING: like RoomCard, it sets no width — it fills whatever the parent gives it.
// Lists cap their height and scroll, so a long list can't grow off the page.

const STATUS_LABEL = { online: 'Online', playing: 'In game', offline: 'Offline' }

// Scrollbar classes are written out literally, not interpolated — Tailwind only
// compiles classes it can read verbatim in the source.
const SCROLL =
  'overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-track]:bg-black/20 [&::-webkit-scrollbar]:w-1.5'

// A friend row. The avatar+name area is a button that opens the friend's profile
// popup (where Remove lives). The trailing slot is either the chevron (default) or,
// when an invite handler is wired (the table's "invite to this room" context), an
// Invite button that flips to "Invited ✓" — offline friends can't be reached.
function FriendRow({ friend, onView, onInvite, invited, inviting }) {
  const offline = friend.status === 'offline'
  return (
    <div className="flex items-center gap-2.5 rounded-[16px] bg-black/20 px-2.5 py-1.5 transition-colors hover:bg-black/30">
      <button
        type="button"
        onClick={() => onView?.(friend)}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9fe03a]"
      >
        <Avatar name={friend.name} size="sm" status={friend.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] text-white [text-shadow:0_2px_2px_rgba(0,0,0,0.4)]">
            {friend.name}
          </div>
          <div className="font-display text-xs text-white/60 [--stroke-width:0]">
            {STATUS_LABEL[friend.status] ?? STATUS_LABEL.offline}
          </div>
        </div>
      </button>

      {onInvite ? (
        invited ? (
          <span className="shrink-0 font-display text-sm text-[#7CE04A] [--stroke-width:0]">Invited ✓</span>
        ) : (
          <Button
            variant="green"
            size="sm"
            disabled={offline || inviting}
            title={offline ? 'This friend is offline' : undefined}
            onClick={() => onInvite(friend)}
          >
            {inviting ? '…' : 'Invite'}
          </Button>
        )
      ) : (
        <span aria-hidden className="shrink-0 font-display text-xl text-white/40">
          ›
        </span>
      )}
    </div>
  )
}

function Row({ name = '', username, subtitle, avatarStatus = 'offline', children }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[16px] bg-black/20 px-2.5 py-1.5">
      <Avatar name={name} size="sm" status={avatarStatus} />
      {/* min-w-0 lets the text truncate — without it the flex item refuses to
          shrink below its content and pushes the buttons out of the row. */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] text-white [text-shadow:0_2px_2px_rgba(0,0,0,0.4)]">
          {name}
        </div>
        {subtitle && <div className="font-display text-xs text-white/60 [--stroke-width:0]">{subtitle}</div>}
        {!subtitle && username && (
          <div className="truncate font-display text-xs text-white/55 [--stroke-width:0]">@{username}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  )
}

// The trailing control on a search hit, chosen by our relation to that user.
function SearchAction({ id, relation, busy, onAdd, onAccept }) {
  if (relation === 'friend') return <span className="font-display text-sm text-[#7CE04A] [--stroke-width:0]">Added ✓</span>
  if (relation === 'outgoing') return <span className="font-display text-sm text-white/55 [--stroke-width:0]">Requested</span>
  if (relation === 'incoming')
    return (
      <Button variant="green" size="sm" disabled={busy} onClick={() => onAccept?.(id)}>
        {busy ? '…' : 'Confirm'}
      </Button>
    )
  return (
    <Button variant="green" size="sm" disabled={busy} onClick={() => onAdd?.(id)}>
      {busy ? '…' : '+ Add'}
    </Button>
  )
}

function Tab({ active, count, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 rounded-[14px] py-1.5 font-display text-[15px] transition-colors [--stroke-width:0] ${
        active ? 'bg-black/30 text-white' : 'text-white/55 hover:text-white/80'
      }`}
    >
      {children}
      {count > 0 && (
        <span className="ml-1.5 rounded-full bg-[#E0483C] px-1.5 py-0.5 align-middle text-xs text-white">{count}</span>
      )}
    </button>
  )
}

/**
 * @param bare  drop the Card shell and render just the contents — for dropping
 *              into something that IS already a panel (e.g. `<Modal>`, which
 *              renders its own Card; nesting would double the border/gradient).
 */
export default function FriendList({
  friends = [],
  incoming = [],
  outgoing = [],
  title = 'Friends',
  onViewFriend,
  // search (optional — the box only shows when onSearchChange is wired)
  searchValue = '',
  onSearchChange,
  searchResults = [],
  searching = false,
  searchError,
  onAddFriend,
  onAcceptRequest,
  onRemovePending,
  busyId,
  // invite-to-room (optional — friend rows show an Invite button when wired)
  onInviteFriend,
  invitedIds = [],
  invitingId,
  bare = false,
  className = '',
}) {
  const [tab, setTab] = useState('friends')
  const showSearch = typeof onSearchChange === 'function'
  const query = searchValue.trim()
  const online = friends.filter((f) => f.status === 'online' || f.status === 'playing').length

  const friendsTab = (
    <>
      {showSearch && (
        <div className="flex flex-col gap-2">
          <TextField
            icon="🔍"
            placeholder="Search players to add…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search players"
          />

          {query.length > 0 && (
            <div className={`flex max-h-56 flex-col gap-1.5 ${SCROLL}`}>
              {searchError ? (
                <p className="px-2 py-3 text-center font-display text-sm text-red-300 [--stroke-width:0]">{searchError}</p>
              ) : searching && searchResults.length === 0 ? (
                <p className="px-2 py-3 text-center font-display text-sm text-white/60 [--stroke-width:0]">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-2 py-3 text-center font-display text-sm text-white/60 [--stroke-width:0]">
                  No players found for “{query}”.
                </p>
              ) : (
                searchResults.map((r) => (
                  <Row key={r.id} name={r.name} username={r.username}>
                    <SearchAction
                      id={r.id}
                      relation={r.relation}
                      busy={busyId === r.id}
                      onAdd={onAddFriend}
                      onAccept={onAcceptRequest}
                    />
                  </Row>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Friends list — hidden while a search is active so the panel doesn't show
          two scrollers at once. */}
      {query.length === 0 &&
        (friends.length === 0 ? (
          <p className="px-2 py-8 text-center font-display text-sm text-white/70 [--stroke-width:0]">
            No friends yet — search above to add some!
          </p>
        ) : (
          <div className={`flex max-h-72 flex-col gap-1.5 ${SCROLL}`}>
            {friends.map((f) => (
              <FriendRow
                key={f.id}
                friend={f}
                onView={onViewFriend}
                onInvite={onInviteFriend}
                invited={invitedIds.includes(f.id)}
                inviting={invitingId === f.id}
              />
            ))}
          </div>
        ))}
    </>
  )

  const requestsTab =
    incoming.length === 0 && outgoing.length === 0 ? (
      <p className="px-2 py-8 text-center font-display text-sm text-white/70 [--stroke-width:0]">
        No pending requests.
      </p>
    ) : (
      <div className={`flex max-h-80 flex-col gap-3 ${SCROLL}`}>
        {incoming.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="px-1 font-display text-xs tracking-wide text-white/50 uppercase [--stroke-width:0]">
              Wants to be friends
            </span>
            {incoming.map((r) => (
              <Row key={r.id} name={r.name} username={r.username}>
                <Button variant="green" size="sm" disabled={busyId === r.id} onClick={() => onAcceptRequest?.(r.id)}>
                  Confirm
                </Button>
                <Button variant="red" size="sm" disabled={busyId === r.id} onClick={() => onRemovePending?.(r.id)}>
                  Decline
                </Button>
              </Row>
            ))}
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="px-1 font-display text-xs tracking-wide text-white/50 uppercase [--stroke-width:0]">
              Request sent
            </span>
            {outgoing.map((r) => (
              <Row key={r.id} name={r.name} username={r.username}>
                <Button variant="red" size="sm" disabled={busyId === r.id} onClick={() => onRemovePending?.(r.id)}>
                  Cancel
                </Button>
              </Row>
            ))}
          </div>
        )}
      </div>
    )

  const body = (
    <>
      <div className="flex items-baseline justify-between px-1">
        <span className="font-display text-xl text-white [--stroke-color:#0F3358]">👥 {title}</span>
        <span className="font-display text-sm text-[#7CE04A] [--stroke-width:0]">{online} online</span>
      </div>

      {/* Tab switcher — Requests carries a red count badge for incoming requests. */}
      <div className="flex gap-1 rounded-[16px] bg-black/20 p-1">
        <Tab active={tab === 'friends'} onClick={() => setTab('friends')}>
          Friends
        </Tab>
        <Tab active={tab === 'requests'} count={incoming.length} onClick={() => setTab('requests')}>
          Requests
        </Tab>
      </div>

      {tab === 'friends' ? friendsTab : requestsTab}
    </>
  )

  // No padding when bare — the host panel already has its own.
  if (bare) return <div className={`flex w-full flex-col gap-2.5 ${className}`}>{body}</div>

  return <Card className={`w-full flex-col gap-2.5 p-3 ${className}`}>{body}</Card>
}
