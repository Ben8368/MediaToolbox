import { createContext, useContext } from 'react'

export const WindowHeaderPortalContext = createContext<HTMLDivElement | null>(null)

export function useWindowHeaderPortalTarget() {
  return useContext(WindowHeaderPortalContext)
}
