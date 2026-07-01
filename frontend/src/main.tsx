import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { bootstrapApiClient } from '@/api/bootstrap'
import App from '@/App'
import '@/styles/globals.css'

bootstrapApiClient()

document.documentElement.style.setProperty('--fnos-wp', 'url(/static/bg/live/wallpaper-3-dark.webp)')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
