import { setApiClient } from '@/api/client'
import { realApi } from '@/api/real'

/** Initialize the production API client. */
export function bootstrapApiClient() {
  setApiClient(realApi)
}
