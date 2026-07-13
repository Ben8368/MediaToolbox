import { apiRequest } from '@/api/http'
import type { FontsListResponse } from '@mediatoolbox/contracts'

export function listSystemFonts(): Promise<FontsListResponse> {
  return apiRequest<FontsListResponse>('/api/fonts/system')
}
