import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useSession, selectIsAuthed } from '../stores/session'
import { useActiveRoomRecovery } from './useActiveRoomRecovery'
import LoginScreen from '../pages/LoginScreen.jsx'
import HomeScreen from '../pages/HomeScreen.jsx'
import LobbyScreen from '../pages/LobbyScreen.jsx'
import TableScreen from '../pages/TableScreen.jsx'
import SoloTableScreen from '../pages/SoloTableScreen.jsx'
import Workbench from '../workbench/Workbench.jsx'

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

  { element: <GuestOnly />, children: [{ path: '/login', element: <LoginScreen /> }] },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/room', element: <LobbyScreen /> },
      { path: '/table/:roomId', element: <TableScreen /> },
      // Client-only "play vs bots" game — no server room (see the CreateRoomForm toggle).
      { path: '/solo', element: <SoloTableScreen /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
