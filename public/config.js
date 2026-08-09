// Runtime configuration — the DEV/local placeholder.
//
// In a container this exact file is REWRITTEN by entrypoint.sh from the environment
// on every start, which is what lets one built image serve any environment. Left
// empty here so `npm run dev` and a plain `npm run build` fall through to the values
// Vite inlined from .env (see src/services/config.js).
//
// Loaded as a classic <script> in index.html, so it runs before the deferred app
// module and window.APP_CONFIG always exists by the time anything reads it.
window.APP_CONFIG = {}
