import type { FastifyInstance } from 'fastify'
import type { AssetListResponse } from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'

export function registerAssetRoutes(app: FastifyInstance, state: ApiState) {
  app.get<{ Reply: AssetListResponse }>('/api/assets', async () => {
    const assets = await state.db.assets.list()
    return { ok: true, assets }
  })
}
