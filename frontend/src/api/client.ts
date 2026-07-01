import { realApi } from '@/api/real'

import type { MediaToolboxApi } from './types'

let activeClient: MediaToolboxApi = realApi

/** Switch API implementation in tests or specialized integrations. */
export function setApiClient(client: MediaToolboxApi): void {
  activeClient = client
}

export function getApiClient(): MediaToolboxApi {
  return activeClient
}
