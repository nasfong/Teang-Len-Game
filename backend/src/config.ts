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
  afk: {
    // How long a player may stay disconnected before the room drops them.
    //
    // This ONLY applies to a room that isn't mid-match. A player who drops during a
    // live match always keeps their seat — a connected client covers their turns —
    // and is removed at endGame if they never came back. A match is never
    // interrupted to remove someone.
    //
    // Generous on purpose: on a phone, switching apps kills the socket within
    // seconds, so a short grace would evict players for glancing at a notification.
    disconnectGraceMs: 45_000,
  },
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
