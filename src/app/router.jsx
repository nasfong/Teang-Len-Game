import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useSession, selectIsAuthed } from '../state/session'
import { useActiveRoomRecovery } from './useActiveRoomRecovery'
import LoginContainer from './LoginContainer.jsx'
import HomeContainer from './HomeContainer.jsx'
import RoomContainer from './RoomContainer.jsx'
import TableContainer from './TableContainer.jsx'
import Workbench from '../App.jsx'

// Signed-in gate — no token bounces to /login. Also the one place inside the router
// tree that every authed screen renders through, so the once-per-launch active-room
// recovery lives here (it needs useNavigate, i.e. RouterProvider context).
function RequireAuth() {
  const authed = useSession(selectIsAuthed)
  useActiveRoomRecovery()
  return authed ? <Outlet /> : <Navigate to="/login" replace />
}

// Already signed in? Skip the login screen.
function GuestOnly() {
  const authed = useSession(selectIsAuthed)
  return authed ? <Navigate to="/" replace /> : <Outlet />
}

export const router = createBrowserRouter([
  // The component workbench (dev catalog) — public, no auth.
  { path: '/component', element: <Workbench /> },

  { element: <GuestOnly />, children: [{ path: '/login', element: <LoginContainer /> }] },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomeContainer /> },
      { path: '/room', element: <RoomContainer /> },
      { path: '/table/:roomId', element: <TableContainer /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
