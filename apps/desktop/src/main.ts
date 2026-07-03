export type DesktopRuntimeMode = 'development' | 'production'

export type DesktopShellConfig = {
  mode: DesktopRuntimeMode
  webUrl: string
  apiUrl: string
}

export function createDesktopShellConfig(env: NodeJS.ProcessEnv): DesktopShellConfig {
  const mode = env.NODE_ENV === 'production' ? 'production' : 'development'

  return {
    mode,
    webUrl: env.MEDIATOOLBOX_WEB_URL ?? 'http://127.0.0.1:5173',
    apiUrl: env.MEDIATOOLBOX_API_URL ?? 'http://127.0.0.1:3701',
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(createDesktopShellConfig(process.env))
}
