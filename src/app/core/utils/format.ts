const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Human-readable byte size: 0 B, 1.5 KB, 12.3 MB, 1.25 GB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : exponent >= 3 ? 2 : 1;
  return `${value.toFixed(digits)} ${UNITS[exponent]}`;
}
