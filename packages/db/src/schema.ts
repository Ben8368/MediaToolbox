/**
 * Database schema definitions and migrations
 */

export const CURRENT_SCHEMA_VERSION = 4

export const SCHEMA_V1 = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  progress_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_kind ON jobs(kind);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  size INTEGER,
  mime_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);
CREATE INDEX IF NOT EXISTS idx_assets_path ON assets(path);
CREATE INDEX IF NOT EXISTS idx_assets_updated_at ON assets(updated_at DESC);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  module TEXT NOT NULL,
  time TEXT NOT NULL,
  user TEXT NOT NULL,
  event TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_module ON logs(module);
CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time DESC);
`

export const SCHEMA_V2_SETTINGS = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

export const SCHEMA_V3_PATH_GRANTS = `
CREATE TABLE IF NOT EXISTS path_grants (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  physical_path TEXT NOT NULL,
  display_name TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  job_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_path_grants_status ON path_grants(status);
CREATE INDEX IF NOT EXISTS idx_path_grants_expires_at ON path_grants(expires_at);
CREATE INDEX IF NOT EXISTS idx_path_grants_job_id ON path_grants(job_id);
`

export const SCHEMA_V4_WORKORDERS = `
CREATE TABLE IF NOT EXISTS psd_workorders (
  id TEXT PRIMARY KEY,
  psd_path TEXT NOT NULL,
  psd_file_name TEXT NOT NULL,
  document_width INTEGER NOT NULL,
  document_height INTEGER NOT NULL,
  document_resolution REAL NOT NULL,
  records_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_psd_workorders_psd_path ON psd_workorders(psd_path);
CREATE INDEX IF NOT EXISTS idx_psd_workorders_updated_at ON psd_workorders(updated_at DESC);
`
