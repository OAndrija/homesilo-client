const PREVIEWABLE_TYPE_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];
const PREVIEWABLE_EXACT_TYPES = ['application/pdf', 'application/json', 'application/xml'];

/** Types the server will render inline (script-capable ones are shown as plain text). */
export function isPreviewable(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const type = contentType.toLowerCase();
  if (PREVIEWABLE_EXACT_TYPES.includes(type)) return true;
  return PREVIEWABLE_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix));
}
