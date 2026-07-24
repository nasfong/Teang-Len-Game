// Pins the app's window box to the height iOS is ACTUALLY showing.
//
// THE BUG (WebKit, home-screen web apps — Apple's own forum thread 128949):
// after a rotation the CSS viewport height goes stale. The content area really is
// bigger, "but it's like CSS doesn't know about it", so 100%/100vh/100dvh all
// resolve to the pre-rotation height and the page ends short of the screen — a
// band of bare canvas along the bottom that nothing inside the page can cover.
// A PWA launched from a portrait home screen and rotated to landscape lands in
// that state on EVERY launch, which is why it never reproduces in a browser tab.
//
// THE WORKAROUND: JS still reports the truth via window.innerHeight, so measure it
// and write the result onto #root (inline, so it beats the stylesheet) plus --app-h
// for anything else that wants it.
//
// innerHeight, deliberately NOT visualViewport.height: the visual viewport shrinks
// when the on-screen keyboard opens, which would collapse the layout mid-typing.
//
// The delays matter: iOS reports the OLD size to the resize/orientationchange
// handler that fires during a rotation, so a single measurement re-pins the stale
// value. Re-reading as the rotation settles catches the real one.
const SETTLE_DELAYS = [0, 120, 300, 600, 1000]

// Launched from the Home Screen, iOS reports a viewport that STOPS ABOVE the home
// indicator: 100dvh — and window.innerHeight with it — resolve to the screen minus
// env(safe-area-inset-bottom), so the UI can never reach the physical edge and the
// strip below it shows bare canvas. Adding the inset back makes the bottom bar run
// into the indicator area, which is where it belongs. Only in an installed app: a
// browser tab's viewport is already correct and this would overflow it.
function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

// env() isn't readable from JS — resolve it through a throwaway element.
function bottomInset() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden;height:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const inset = parseFloat(getComputedStyle(probe).height) || 0
  probe.remove()
  return inset
}

function apply() {
  const h = window.innerHeight + (isStandalone() ? bottomInset() : 0)
  if (!h) return
  document.documentElement.style.setProperty('--app-h', `${h}px`)
  const root = document.getElementById('root')
  if (root) root.style.height = `${h}px`
}

function applyWhileSettling() {
  for (const delay of SETTLE_DELAYS) setTimeout(apply, delay)
}

export function installAppHeight() {
  apply()
  window.addEventListener('resize', apply)
  // Every way a rotation can be announced — Safari fires these inconsistently in
  // standalone mode, and missing one leaves the band up until the next resize.
  window.addEventListener('orientationchange', applyWhileSettling)
  window.screen?.orientation?.addEventListener?.('change', applyWhileSettling)
  // Returning from the app switcher / launching from a cold start can restore a
  // stale size the same way a rotation does.
  window.addEventListener('pageshow', applyWhileSettling)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyWhileSettling()
  })
}
