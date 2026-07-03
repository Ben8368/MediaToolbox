/** 从 unknown 错误中安全提取可读消息 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err
  return '发生未知错误'
}
