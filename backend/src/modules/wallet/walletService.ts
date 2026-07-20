import { config } from '../../config'
import type { Currency, Wallet } from '../../types'

// In-memory wallet (spec §3.3). ALL balance changes go through credit()/debit() —
// the single auditable money path. This module knows nothing about rooms or games.
const wallets = new Map<string, Wallet>()

/** Provision a fresh wallet with default balances. Idempotent. */
export function provisionWallet(userId: string): Wallet {
  const existing = wallets.get(userId)
  if (existing) return existing
  const wallet: Wallet = { ...config.defaultWallet }
  wallets.set(userId, wallet)
  return wallet
}

export function getWallet(userId: string): Wallet {
  return wallets.get(userId) ?? provisionWallet(userId)
}

export function canAfford(userId: string, currency: Currency, amount: number): boolean {
  if (amount <= 0) return true
  return getWallet(userId)[currency] >= amount
}

/** Add a positive-integer amount. Returns the new balances. */
export function credit(userId: string, currency: Currency, amount: number): Wallet {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('credit amount must be a positive integer')
  const wallet = getWallet(userId)
  wallet[currency] += amount
  return wallet
}

/** Subtract a positive-integer amount; throws on insufficient funds. */
export function debit(userId: string, currency: Currency, amount: number): Wallet {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('debit amount must be a positive integer')
  const wallet = getWallet(userId)
  if (wallet[currency] < amount) throw new InsufficientFundsError()
  wallet[currency] -= amount
  return wallet
}

export class InsufficientFundsError extends Error {
  constructor() {
    super('Not enough coins.')
    this.name = 'InsufficientFundsError'
  }
}

// ── Domain helpers (built on credit/debit) ──────────────────────────────────

/** Apply a game settlement delta at match end: credit a win, debit a loss, no-op
 *  on zero. Nothing is charged on join — only the result moves coins. A loss is
 *  clamped so a wallet can never go negative (the join-time affordability check
 *  already guarantees each player can cover one full bet, their worst case). */
export function settle(userId: string, delta: number): Wallet {
  const amount = Math.round(delta)
  if (amount > 0) return credit(userId, 'coin', amount)
  if (amount < 0) {
    const loss = Math.min(-amount, getWallet(userId).coin)
    if (loss > 0) return debit(userId, 'coin', loss)
  }
  return getWallet(userId)
}
