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

export const transcodeJobCreateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['inputPath', 'outputPath'],
    properties: {
      inputPath: { type: 'string', minLength: 1 },
      outputPath: { type: 'string', minLength: 1 },
      preset: { type: 'string', enum: ['mp4-h264-aac', 'audio-mp3', 'copy'] },
      title: { type: 'string' },
    },
  },
} as const

export const browserNetworkDownloadCreateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['source_url', 'filename', 'target_path', 'view_id', 'session_id'],
    properties: {
      source_url: { type: 'string', minLength: 1 },
      url_chain: { type: 'array', items: { type: 'string' } },
      filename: { type: 'string', minLength: 1 },
      target_path: { type: 'string', minLength: 1 },
      view_id: { type: 'string', minLength: 1 },
      session_id: { type: 'string', minLength: 1 },
      total_bytes: { type: 'number', minimum: 0 },
      mime_type: { type: 'string' },
      user_gesture: { type: 'boolean' },
    },
  },
} as const

export const browserNetworkDownloadUpdateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['pending', 'running', 'succeeded', 'failed', 'canceled'] },
      received_bytes: { type: 'number', minimum: 0 },
      total_bytes: { type: 'number', minimum: 0 },
      error: { type: 'string' },
    },
  },
} as const

export const browserNetworkPermissionEventSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['view_id', 'session_id', 'origin', 'permission', 'decision'],
    properties: {
      view_id: { type: 'string', minLength: 1 },
      session_id: { type: 'string', minLength: 1 },
      origin: { type: 'string', minLength: 1 },
      permission: { type: 'string', minLength: 1 },
      decision: { type: 'string', enum: ['granted', 'denied'] },
      reason: { type: 'string' },
    },
  },
} as const
