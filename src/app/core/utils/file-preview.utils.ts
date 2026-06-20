const PREVIEWABLE_TYPE_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];
const PREVIEWABLE_EXACT_TYPES = ['application/pdf'];

export function isPreviewable(contentType: string): boolean {
  if (PREVIEWABLE_EXACT_TYPES.includes(contentType)) return true;
  return PREVIEWABLE_TYPE_PREFIXES.some((prefix) => contentType.startsWith(prefix));
}
