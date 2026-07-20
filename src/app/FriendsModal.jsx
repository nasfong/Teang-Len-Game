import Modal from '../components/Modal/Modal.jsx'
import FriendsPanel from './FriendsPanel.jsx'

// The one friends popup, reusable anywhere. Shows the full friends experience —
// friends list, requests (confirm/decline/cancel), and search-to-add, plus the
// per-friend profile popup with Remove. Controlled via open/onClose.
//
//   <FriendsModal open={open} onClose={close} />              // Home: manage friends
//   <FriendsModal open={open} onClose={close} roomId={id} />  // Table: + Invite buttons
//
// Passing `roomId` turns on a per-friend Invite action (rings that friend into the
// room); without it, it's the plain friends manager.
export default function FriendsModal({ open, onClose, roomId }) {
  return (
    <Modal open={open} onClose={onClose}>
      <FriendsPanel roomId={roomId} title={roomId ? 'Invite Friends' : 'Friends'} />
    </Modal>
  )
}
