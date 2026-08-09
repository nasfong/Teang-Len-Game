// Every deploy-time setting the client reads, resolved once, in one place.
//
// Two sources, runtime first:
//   window.APP_CONFIG  written by entrypoint.sh from the container's env at start-up
//                      (public/config.js) — one image, any environment
//   import.meta.env    inlined by Vite at BUILD time — `npm run dev` and .env
//
// Runtime wins, so a deployed image can be pointed at a different API with an env var
// and a restart. Falling back to the build-time value keeps dev working with no
// container involved.
//
// The build-time values are read as LITERAL `import.meta.env.VITE_X` expressions —
// Vite substitutes those textually, so `import.meta.env[key]` with a computed key
// would come back undefined in a production build.
const BUILD = {
  API_URL: import.meta.env.VITE_API_URL,
  AUTO_GUEST: import.meta.env.VITE_AUTO_GUEST,
  AUTO_GUEST_PREFIX: import.meta.env.VITE_AUTO_GUEST_PREFIX,
  DEBUG_PEEK: import.meta.env.VITE_DEBUG_PEEK,
}

const RUNTIME = (typeof window !== 'undefined' && window.APP_CONFIG) || {}

// '' counts as unset: an env var the container was never given lands as an empty
// string, not undefined, so `??` alone would let it beat the fallback.
function read(key, fallback) {
  const value = RUNTIME[key] ?? BUILD[key]
  return value === undefined || value === null || value === '' ? fallback : value
}

/** Backend origin. */
export const API_URL = read('API_URL', 'http://localhost:4000')

/** Testing deployments only — see features/auth/autoGuest.js. */
export const AUTO_GUEST_ENABLED = read('AUTO_GUEST', 'false') === 'true'
export const AUTO_GUEST_PREFIX = read('AUTO_GUEST_PREFIX', 'test')

/**
 * X-ray: draw every opponent's hand face-up and dimmed. DEBUGGING ONLY.
 *
 * This reveals nothing the client wasn't already given — under trust model v1 the
 * relayed gameState carries ALL hands (see games/teanglen/match.js), so this only
 * draws data that is already sitting in the socket payload. That is exactly why it
 * must stay off in production: turning it on hands every player a legitimate view
 * of everyone's cards, and the table has no way to know.
 *
 * A table running with it on wears a red PEEK badge (features/table/TableLayout.jsx)
 * so it can never be left on unnoticed. The real fix for the underlying exposure is
 * private per-seat hands, which is a separate piece of work.
 */
export const DEBUG_PEEK = read('DEBUG_PEEK', 'false') === 'true'
