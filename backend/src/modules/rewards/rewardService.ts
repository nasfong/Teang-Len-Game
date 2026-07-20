import { config } from '../../config'
import { ok, fail, type ServiceResult, type Wallet } from '../../types'
import { credit } from '../wallet/walletService'

// Rewarded-ad coins. The reward amount and the throttle live on the SERVER — the
// client only says "the ad finished," it never dictates how much it's worth. A
// per-user cooldown (in-memory, like the rest of the app) stops the endpoint from
// being a one-click coin faucet.
//
// PRODUCTION NOTE: real anti-abuse needs the ad network's server-side verification
// (SSV) — the network calls us to confirm a real impression before we credit. This
// cooldown is a stopgap, not proof an ad was watched.
const lastClaimAt = new Map<string, number>()

export interface AdRewardResult {
  wallet: Wallet
  reward: number
  nextAvailableAt: number // epoch ms the user may claim again
}

export function claimAdReward(userId: string): ServiceResult<AdRewardResult> {
  const now = Date.now()
  const readyAt = (lastClaimAt.get(userId) ?? 0) + config.adReward.cooldownMs

  if (now < readyAt) {
    const seconds = Math.ceil((readyAt - now) / 1000)
    return fail(`Please wait ${seconds}s before the next free coins.`, 429)
  }

  const reward = config.adReward.coin
  const wallet = credit(userId, 'coin', reward)
  lastClaimAt.set(userId, now)
  return ok({ wallet, reward, nextAvailableAt: now + config.adReward.cooldownMs })
}
