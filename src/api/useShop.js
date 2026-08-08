import { useMutation, useQuery } from '@tanstack/react-query'
import * as shopService from '../services/shop'
import { useSession } from '../stores/session'
import { queryKeys } from './keys'

// Shop catalog from the API (products typed 'purchase' | 'ads'). Rarely changes, so
// a long staleTime — the screen maps each product to Shop pack props via the adapter.
export function useProducts() {
  const token = useSession((s) => s.token)

  return useQuery({
    queryKey: queryKeys.shopProducts,
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    queryFn: shopService.getProducts,
  })
}

// Claim rewarded-ad coins. The SERVER owns the amount + cooldown — we just say the
// ad finished — and returns the new wallet, which becomes the session wallet. A
// cooldown hit surfaces as an ApiError (429) for the caller to show.
export function useClaimAdReward() {
  const setWallet = useSession((s) => s.setWallet)

  return useMutation({
    mutationFn: shopService.claimAdReward,
    onSuccess: ({ wallet }) => setWallet(wallet),
  })
}
