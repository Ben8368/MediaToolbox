/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deprecated; the app now runs against the real API by default. */
  readonly VITE_API_MODE?: string
  /** Real API base URL, for example `http://127.0.0.1:8080`. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
