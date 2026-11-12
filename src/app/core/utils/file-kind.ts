/** Friendly names for common file types, by MIME type. */
const BY_TYPE: Record<string, string> = {
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/gif': 'GIF image',
  'image/webp': 'WebP image',
  'image/svg+xml': 'SVG image',
  'image/heic': 'HEIC image',
  'image/bmp': 'Bitmap image',
  'image/tiff': 'TIFF image',
  'application/pdf': 'PDF document',
  'application/msword': 'Word document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
  'application/vnd.ms-excel': 'Excel spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel spreadsheet',
  'application/vnd.ms-powerpoint': 'PowerPoint presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'PowerPoint presentation',
  'application/vnd.oasis.opendocument.text': 'OpenDocument text',
  'application/vnd.oasis.opendocument.spreadsheet': 'OpenDocument spreadsheet',
  'application/zip': 'ZIP archive',
  'application/x-7z-compressed': '7-Zip archive',
  'application/x-rar-compressed': 'RAR archive',
  'application/vnd.rar': 'RAR archive',
  'application/gzip': 'Gzip archive',
  'application/x-gzip': 'Gzip archive',
  'application/x-tar': 'Tar archive',
  'application/json': 'JSON file',
  'application/xml': 'XML file',
  'text/plain': 'Plain text',
  'text/markdown': 'Markdown text',
  'text/x-web-markdown': 'Markdown text',
  'text/csv': 'CSV table',
  'text/html': 'HTML page',
  'text/css': 'CSS stylesheet',
  'video/mp4': 'MP4 video',
  'video/quicktime': 'QuickTime video',
  'video/webm': 'WebM video',
  'video/x-matroska': 'Matroska video',
  'audio/mpeg': 'MP3 audio',
  'audio/wav': 'WAV audio',
  'audio/x-wav': 'WAV audio',
  'audio/flac': 'FLAC audio',
  'audio/ogg': 'Ogg audio',
  'audio/mp4': 'AAC audio',
};

const BY_FAMILY: Record<string, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  text: 'text file',
};

/** "JPEG image", "Word document", "MKV video"… or "ABC file" for the unknown. */
export function describeKind(fileName: string, contentType: string): string {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (BY_TYPE[type]) return BY_TYPE[type];
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot + 1).toUpperCase() : '';
  const family = BY_FAMILY[type.split('/')[0]];
  if (family) return ext ? `${ext} ${family}` : family[0].toUpperCase() + family.slice(1);
  return ext ? `${ext} file` : 'File';
}
