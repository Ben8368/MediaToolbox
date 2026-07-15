import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { bootstrapApiClient } from '@/api/bootstrap'
import App from '@/App'
import { PresetStandalonePage } from '@/pages/PresetStandalonePage'
import '@/styles/globals.css'

bootstrapApiClient()

document.documentElement.style.setProperty('--mt-wp', 'url(/static/bg/live/wallpaper-3-dark.webp)')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/preset/:presetId" element={<PresetStandalonePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
