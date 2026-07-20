import { useEffect, useState } from 'react'
import ProgressBar from '../components/ProgressBar/ProgressBar.jsx'

// Preloader — the GLOBAL asset gate, and the FIRST thing the app renders. A card
// game should paint whole, so nothing shows until every bundled image/icon is
// downloaded, the display font is ready, AND the app's own code chunk has arrived.
//
// It lives in the tiny entry chunk (no motion, no app imports), so it can paint the
// progress screen quickly; the heavy app is pulled in via a dynamic import() that
// downloads in parallel with the images. Vite resolves every asset to its hashed
// URL at build time (import.meta.glob) — that's every icon, card, background and
// mascot under src/. Runtime URLs (none today) wouldn't be covered.

// A plain default import of an image already resolves to its URL — the SAME URL the
// components import (e.g. `import bg from './background.webp'`). No `?url` query, so
// the preloaded request and the page's request share a cache key (in dev too);
// otherwise the warm-up would fetch a different URL and the page would still miss.
const ASSET_URLS = Object.values(
  import.meta.glob('/src/**/*.{png,jpg,jpeg,webp,gif,svg,avif}', {
    eager: true,
    import: 'default',
  }),
)

// Retain the Image objects for the app's lifetime so their decoded bitmaps aren't
// garbage-collected before the page paints — that's what stops a big background
// from flashing blank right after the loader hands off.
const RETAINED = []

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    RETAINED.push(img)
    img.src = url
    // decode() resolves only when the image is fully DECODED and ready to paint —
    // onload just means the bytes arrived, which for a large PNG still leaves a
    // decode (and a blank frame) to happen at render time. Fall back to onload
    // where decode() is unavailable; a broken asset must not wedge the gate.
    if (img.decode) {
      img.decode().then(resolve, resolve)
    } else {
      img.onload = img.onerror = () => resolve()
    }
  })
}

// Best-effort font wait — the outlined display type is central to the look. Never
// rejects; a browser without the Font Loading API just skips it.
function preloadFonts() {
  if (!document.fonts?.load) return Promise.resolve()
  return Promise.all([
    document.fonts.load('400 1em "Lilita One"'),
    document.fonts.load('700 1em "Lilita One"'),
  ])
    .then(() => document.fonts.ready)
    .catch(() => {})
}

export default function Preloader() {
  const [loaded, setLoaded] = useState(0)
  const [App, setApp] = useState(null) // the app component, once its chunk + assets are in
  const total = ASSET_URLS.length

  useEffect(() => {
    let cancelled = false
    let count = 0
    const bump = () => {
      count += 1
      if (!cancelled) setLoaded(count)
    }

    const images = ASSET_URLS.map((url) => preloadImage(url).then(bump))
    // Kick the app's code chunk downloading NOW, in parallel with the images.
    const appChunk = import('./AppRoot.jsx')

    Promise.all([...images, preloadFonts(), appChunk]).then((results) => {
      if (cancelled) return
      const mod = results[results.length - 1] // the appChunk result
      setApp(() => mod.default)
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (App) return <App />

  // Cap at 99% until EVERYTHING (incl. the app chunk + font) is ready, so the bar
  // never reads 100% while the app is still downloading.
  const pct = App ? 100 : Math.min(99, total ? Math.round((loaded / total) * 100) : 99)

  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 overflow-hidden bg-linear-to-b from-[#2B7FC9] to-[#0F3358] px-6">
      <div className="text-center">
        <h1 className="font-display text-5xl text-white [--stroke-color:#00376B] drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]">
          Teang Len
        </h1>
        <p className="font-display text-2xl text-[#FFD27A] [--stroke-color:#7A4A10] drop-shadow-[0_3px_5px_rgba(0,0,0,0.4)]">
          Game
        </p>
      </div>

      <div className="w-full max-w-xs">
        <ProgressBar value={pct} max={100} color="green" label={`${pct}%`} size="lg" />
      </div>

      <p className="font-display text-sm text-white/85 [--stroke-width:0] [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
        Loading…
      </p>
    </div>
  )
}
