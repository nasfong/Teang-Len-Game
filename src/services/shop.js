import { apiFetch } from './http'

// Shop + rewards requests.

/** Catalog products, typed 'purchase' | 'ads'. */
export async function getProducts() {
  const { products } = await apiFetch('/api/shop/products')
  return products
}

// Claim rewarded-ad coins. The SERVER owns the amount and the cooldown — the client
// only reports that the ad finished. A cooldown hit comes back as a 429 ApiError.
export function claimAdReward() {
  return apiFetch('/api/rewards/ad', { method: 'POST' })
}
