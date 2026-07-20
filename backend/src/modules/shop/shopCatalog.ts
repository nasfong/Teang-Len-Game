import { config } from '../../config'

// The shop catalog. MOCK for now — no payment backend yet — but shaped like the
// real thing so the client can render straight from it. Each product is typed:
//   'ads'      → the rewarded-video row (claimed via POST /api/rewards/ad)
//   'purchase' → a paid coin pack (real checkout is future work)
// Presentation (icons, colours, layout) is the CLIENT's job; this is data only.
export interface ShopProduct {
  id: string
  type: 'purchase' | 'ads'
  coins: number
  price?: string // purchase only — display price
  bonus?: string // purchase only — e.g. '+10%'
  tag?: string // purchase only — e.g. 'Best value'
}

export function listProducts(): ShopProduct[] {
  return [
    // The ad reward mirrors the rewarded-video config, so the catalog and
    // POST /api/rewards/ad always agree on the amount.
    { id: 'ad', type: 'ads', coins: config.adReward.coin },
    { id: 'starter', type: 'purchase', coins: 1000, price: '$0.99' },
    { id: 'stack', type: 'purchase', coins: 5500, price: '$4.99', bonus: '+10%' },
    { id: 'pile', type: 'purchase', coins: 12000, price: '$9.99', bonus: '+20%', tag: 'Best value' },
    { id: 'vault', type: 'purchase', coins: 30000, price: '$19.99', bonus: '+25%' },
  ]
}
