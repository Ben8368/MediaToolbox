import type { MediaToolboxApi } from '@/api/types'

import * as filesystem from './filesystem'
import * as jobs from './jobs'
import * as logs from './logs'
import * as metrics from './metrics'
import * as tasks from './tasks'

/** Real HTTP API implementation used by default. */
export const realApi = {
  ...tasks,
  ...jobs,
  ...filesystem,
  ...metrics,
  ...logs,
} satisfies MediaToolboxApi
