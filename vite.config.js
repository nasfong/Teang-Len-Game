import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Single entry: index.html → src/main.jsx boots the app (Login → Home). The
// component workbench is a route inside it, at /component.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Keep every image as its OWN file — don't inline small ones as base64. The
    // Preloader eager-globs all assets and downloads them during the loading screen;
    // inlining would instead bake them into the tiny entry chunk (bloating first
    // paint) and lose their separate cacheable URLs.
    assetsInlineLimit: 0,
  },
})
