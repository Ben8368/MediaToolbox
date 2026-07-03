export const fetchTaskSubmitSchema = {
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      url: { type: 'string', minLength: 1 },
      urls: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
      output_dir: { type: 'string' },
      write_subs: { type: 'boolean' },
      write_auto_subs: { type: 'boolean' },
      sub_langs: { type: 'string' },
      prefer_h264: { type: 'boolean' },
      no_transcode: { type: 'boolean' },
      subtitle_format: { type: 'string' },
      max_concurrent: { type: 'number' },
      cookies_from_browser: { type: 'string' },
    },
    anyOf: [{ required: ['url'] }, { required: ['urls'] }],
  },
} as const

export const filebrowserListSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      directory: { type: 'string' },
    },
  },
} as const

export const filebrowserMkdirSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', minLength: 1 },
    },
  },
} as const

export const filebrowserDeleteSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', minLength: 1 },
      to_trash: { type: 'boolean' },
    },
  },
} as const

export const setWorkspaceSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['workspace'],
    properties: {
      workspace: { type: 'string', minLength: 1 },
    },
  },
} as const

export const clearFetchTasksSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      task_ids: { type: 'array', items: { type: 'string' } },
    },
  },
} as const
