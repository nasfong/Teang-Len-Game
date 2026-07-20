import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Preloader from './app/Preloader.jsx'
import './index.css'

// Tiny entry chunk: it renders ONLY the Preloader (which shows progress and then
// dynamically imports the app — see Preloader/AppRoot). Keeping the heavy app out
// of this chunk means the loading screen paints as early as possible.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Preloader />
  </StrictMode>,
)
