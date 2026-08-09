import { apiFetch } from './http'

/** Catalog products, typed 'purchase' | 'ads'. */
export async function getProducts() {
  const { products } = await apiFetch('/api/shop/products')
  return products
}

// The SERVER owns the amount and cooldown — the client only reports the ad finished.
// A cooldown hit comes back as a 429.
export function claimAdReward() {
  return apiFetch('/api/rewards/ad', { method: 'POST' })
}
