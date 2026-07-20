import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../net/api'
import { useSession } from '../state/session'

// Claim rewarded-ad coins. The SERVER owns the amount + cooldown — we just say the
// ad finished — and returns the new wallet, which becomes the session wallet. A
// cooldown hit surfaces as an ApiError (429) for the caller to show.
export function useClaimAdReward() {
  const setWallet = useSession((s) => s.setWallet)

  return useMutation({
    mutationFn: () => apiFetch('/api/rewards/ad', { method: 'POST' }),
    onSuccess: ({ wallet }) => setWallet(wallet),
  })
}
