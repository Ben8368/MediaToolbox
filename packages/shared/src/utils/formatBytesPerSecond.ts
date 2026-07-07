export function formatBytesPerSecond(value: number): string {
  if (value < 1024) return `${value} B/s`
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB/s`
  if (value < 1024 * 1024 * 1024) return `${Math.round(value / 1024 / 102.4) / 10} MB/s`
  return `${Math.round(value / 1024 / 1024 / 102.4) / 10} GB/s`
}
