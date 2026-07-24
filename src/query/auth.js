import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from '../net/api'
import { useSession } from '../state/session'

// Auth server-state, via TanStack Query.
//
// login/register are MUTATIONS: they call the backend and, on success, write the
// returned session ({ token, user, wallet }) into the Zustand session store —
// which is what every screen reads. AuthForm reports mode 'login' | 'register',
// mapping straight to the two endpoints.
export function useAuth() {
  const setSession = useSession((s) => s.setSession)

  return useMutation({
    mutationFn: ({ mode, username, password }) => {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
      return apiFetch(path, { method: 'POST', auth: false, body: { username, password } })
    },
    onSuccess: (data) => setSession(data),
  })
}

// Wallet is server state — refetch the fresh balance and mirror it into the
// session so the Header/Home read one source. Enabled only when signed in.
export function useWallet() {
  const token = useSession((s) => s.token)
  const setWallet = useSession((s) => s.setWallet)

  return useQuery({
    queryKey: ['wallet'],
    enabled: Boolean(token),
    queryFn: async () => {
      const wallet = await apiFetch('/api/wallet')
      console.log("wallet:", wallet)
      setWallet(wallet)
      return wallet
    },
  })
}
