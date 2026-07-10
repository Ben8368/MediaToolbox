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
      download_route: { type: 'string', enum: ['auto', 'ytdlp', 'browser'] },
      transport: { type: 'string', enum: ['browser-network', 'direct'] },
    },
    anyOf: [{ required: ['url'] }, { required: ['urls'] }],
  },
} as const

export const downloadAnalyzeSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['url'],
    properties: {
      url: { type: 'string', minLength: 1 },
      requested_route: { type: 'string', enum: ['auto', 'ytdlp', 'browser'] },
    },
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
    allOf: [
      { anyOf: [{ required: ['inputPath'] }, { required: ['inputGrantId'] }] },
      { anyOf: [{ required: ['outputPath'] }, { required: ['outputGrantId'] }] },
    ],
    properties: {
      inputPath: { type: 'string', minLength: 1 },
      outputPath: { type: 'string', minLength: 1 },
      inputGrantId: { type: 'string', minLength: 1 },
      outputGrantId: { type: 'string', minLength: 1 },
      preset: { type: 'string', enum: ['mp4-h264-aac', 'mp4-h265-aac', 'mkv-h265-aac', 'audio-aac', 'audio-mp3', 'copy', 'remux'] },
      title: { type: 'string' },
      videoCrf: { type: 'number', minimum: 0, maximum: 51 },
      videoEncodePreset: { type: 'string', enum: ['fast', 'slow', 'veryslow'] },
      audioBitrate: { type: 'number', minimum: 64, maximum: 640 },
      targetBitrateKbps: { type: 'number', minimum: 500, maximum: 100000 },
      enableVmaf: { type: 'boolean' },
    },
  },
} as const

export const transcodeProbeSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    anyOf: [{ required: ['inputPath'] }, { required: ['inputGrantId'] }],
    properties: {
      inputPath: { type: 'string', minLength: 1 },
      inputGrantId: { type: 'string', minLength: 1 },
    },
  },
} as const

export const transcodePreviewCommandSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      inputPath: { type: 'string' },
      outputPath: { type: 'string' },
      preset: { type: 'string', enum: ['mp4-h264-aac', 'mp4-h265-aac', 'mkv-h265-aac', 'audio-aac', 'audio-mp3', 'copy', 'remux'] },
      videoCrf: { type: 'number', minimum: 0, maximum: 51 },
      videoEncodePreset: { type: 'string', enum: ['fast', 'slow', 'veryslow'] },
      audioBitrate: { type: 'number', minimum: 64, maximum: 640 },
      targetBitrateKbps: { type: 'number', minimum: 500, maximum: 100000 },
    },
  },
} as const

export const browserNetworkDownloadCreateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['source_url', 'filename', 'target_path', 'view_id', 'session_id'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[A-Za-z0-9._:-]+$' },
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

export const browserNetworkRequestCreateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['url', 'method', 'view_id', 'session_id'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[A-Za-z0-9._:-]+$' },
      url: { type: 'string', minLength: 1 },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
      view_id: { type: 'string', minLength: 1 },
      session_id: { type: 'string', minLength: 1 },
      request_headers: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      request_bytes: { type: 'number', minimum: 0 },
    },
  },
} as const

export const browserNetworkRequestUpdateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['pending', 'running', 'succeeded', 'failed', 'canceled'] },
      response_status: { type: 'number', minimum: 100, maximum: 599 },
      response_headers: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      response_bytes: { type: 'number', minimum: 0 },
      error: { type: 'string' },
    },
  },
} as const

export const psdScanSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['psdPath'],
    properties: {
      psdPath: { type: 'string', minLength: 1 },
    },
  },
} as const

export const psdWorkOrderUpdateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['workOrder'],
    properties: {
      workOrder: { type: 'object' },
    },
  },
} as const
