import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { WebComposerPreviewRuntime } from '@/apps/web-composer/WebComposerPreviewRuntime'
import '@/apps/web-composer/presets/presets.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebComposerPreviewRuntime />
  </StrictMode>,
)
