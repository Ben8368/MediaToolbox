import { StrictMode } from 'react'
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'

import { bootstrapApiClient } from '@/api/bootstrap'
import App from '@/App'
import { AppLoadBoundary } from '@/components/AppLoadBoundary'
import '@/styles/globals.css'

const PresetStandalonePage = lazy(() => import('@/pages/PresetStandalonePage')
  .then((module) => ({ default: module.PresetStandalonePage })))

bootstrapApiClient()

document.documentElement.style.setProperty('--mt-wp', 'url(/static/bg/live/wallpaper-3-dark.webp)')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppLoadBoundary resetKey={window.location.pathname}>
        <Suspense fallback={<div className="mt-app-loading mt-app-loading--fullscreen" role="status">正在加载...</div>}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/preset" element={<Navigate to="/preset/lumora" replace />} />
            <Route path="/preset/:presetId" element={<PresetStandalonePage />} />
          </Routes>
        </Suspense>
      </AppLoadBoundary>
    </BrowserRouter>
  </StrictMode>,
)
