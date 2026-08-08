import { useMutation, useQuery } from '@tanstack/react-query'
import * as authService from '../services/auth'
import { useSession } from '../stores/session'
import { queryKeys } from './keys'

// Auth server-state, via TanStack Query.
//
// login/register are MUTATIONS: they call the backend and, on success, write the
// returned session ({ token, user, wallet }) into the Zustand session store —
// which is what every screen reads. AuthForm reports mode 'login' | 'register',
// which authService maps to the two endpoints.
export function useAuth() {
  const setSession = useSession((s) => s.setSession)

  return useMutation({
    mutationFn: authService.authenticate,
    onSuccess: (data) => setSession(data),
  })
}

// Wallet is server state — refetch the fresh balance and mirror it into the
// session so the Header/Home read one source. Enabled only when signed in.
export function useWallet() {
  const token = useSession((s) => s.token)
  const setWallet = useSession((s) => s.setWallet)

  return useQuery({
    queryKey: queryKeys.wallet,
    enabled: Boolean(token),
    queryFn: async () => {
      const wallet = await authService.getWallet()
      setWallet(wallet)
      return wallet
    },
  })
}
