import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// Boot-time SW register → ./sw.js, root scope (Lucifer pattern via vite-plugin-pwa)
registerSW({
  immediate: true,
  onRegisteredSW(swUrl) {
    if (import.meta.env.DEV) {
      console.info('[STARFALL] SW registered at', swUrl)
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
