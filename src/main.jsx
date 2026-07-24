import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Preloader from './app/Preloader.jsx'
import { installAppHeight } from './app/appHeight'
import './index.css'

// Pin #root to the height iOS is really showing, BEFORE the first render — see
// app/appHeight.js for the WebKit stale-viewport bug this exists to defeat.
installAppHeight()

// Tiny entry chunk: it renders ONLY the Preloader (which shows progress and then
// dynamically imports the app — see Preloader/AppRoot). Keeping the heavy app out
// of this chunk means the loading screen paints as early as possible.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Preloader />
  </StrictMode>,
)
