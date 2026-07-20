import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../net/api'
import { useSession } from '../state/session'

// Shop catalog from the API (products typed 'purchase' | 'ads'). Rarely changes, so
// a long staleTime — the container maps each product to Shop pack props.
export function useProducts() {
  const token = useSession((s) => s.token)

  return useQuery({
    queryKey: ['shop-products'],
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { products } = await apiFetch('/api/shop/products')
      return products
    },
  })
}
