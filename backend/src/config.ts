// Environment configuration with safe dev defaults (spec §12).
const DEV_SECRET = 'dev-insecure-change-me'

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? '*',
  authSecret: process.env.AUTH_SECRET ?? DEV_SECRET,
  jwtTtlSeconds: 7 * 24 * 60 * 60, // 7 days
  defaultWallet: { coin: 10_000, gem: 0 },
  defaultTurnDurationMs: 15_000,
  turnClampSeconds: { min: 5, max: 120 },
  // Rewarded-video coins. The SERVER owns the amount (never trust the client), and
  // a per-user cooldown throttles the faucet. NOTE: a genuine anti-abuse guard needs
  // the ad network's server-side verification (SSV) callback — this cooldown alone
  // does not prove an ad was actually watched.
  adReward: { coin: 500, cooldownMs: 30_000 },
}

if (!process.env.AUTH_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('[config] AUTH_SECRET is unset — using an INSECURE dev fallback. Set AUTH_SECRET in production.')
}
