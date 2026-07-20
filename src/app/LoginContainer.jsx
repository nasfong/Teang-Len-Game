import { useNavigate } from 'react-router-dom'
import LoginPage from '../components/LoginPage/LoginPage.jsx'
import { useAuth } from '../query/auth'

// LoginContainer — wires the presentational LoginPage to the auth mutation +
// session store. The page reports { mode, username, password }; the mutation hits
// /auth/login or /auth/register and, on success, fills the session; we navigate
// home. A failed request surfaces as a banner (AuthForm has no error slot).
export default function LoginContainer() {
  const navigate = useNavigate()
  const { mutateAsync, isPending, error, reset } = useAuth()

  async function handleSubmit(creds) {
    try {
      await mutateAsync(creds)
      navigate('/', { replace: true })
    } catch {
      // error is captured by the mutation and rendered below.
    }
  }

  return (
    <div className="relative">
      {error && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-center px-4">
          <span className="rounded-full border-2 border-[#E0524A] bg-[#FFF1EF] px-4 py-1.5 font-display text-sm text-[#B3241B] shadow-[0_3px_0_#C73830,0_7px_14px_rgba(0,0,0,0.22)] [--stroke-width:0]">
            {error.message}
          </span>
        </div>
      )}
      <LoginPage busy={isPending} onSubmit={handleSubmit} onModeChange={() => reset()} />
    </div>
  )
}
