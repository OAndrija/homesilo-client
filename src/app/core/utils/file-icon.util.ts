interface FileIconInfo {
  icon: string;
  color: string;
}

const EXTENSION_MAP: Record<string, FileIconInfo> = {
  // Documents
  pdf: { icon: 'picture_as_pdf', color: '#F87171' },
  doc: { icon: 'description', color: '#60A5FA' },
  docx: { icon: 'description', color: '#60A5FA' },
  txt: { icon: 'description', color: '#9CA3AF' },
  rtf: { icon: 'description', color: '#9CA3AF' },

  // Spreadsheets
  xls: { icon: 'table_chart', color: '#34D399' },
  xlsx: { icon: 'table_chart', color: '#34D399' },
  csv: { icon: 'table_chart', color: '#34D399' },
  ods: { icon: 'table_chart', color: '#34D399' },

  // Slides
  ppt: { icon: 'slideshow', color: '#FB923C' },
  pptx: { icon: 'slideshow', color: '#FB923C' },

  // Images
  jpg: { icon: 'image', color: '#A78BFA' },
  jpeg: { icon: 'image', color: '#A78BFA' },
  png: { icon: 'image', color: '#A78BFA' },
  gif: { icon: 'image', color: '#A78BFA' },
  svg: { icon: 'image', color: '#A78BFA' },
  webp: { icon: 'image', color: '#A78BFA' },

  // Video
  mp4: { icon: 'videocam', color: '#F472B6' },
  mov: { icon: 'videocam', color: '#F472B6' },
  avi: { icon: 'videocam', color: '#F472B6' },
  mkv: { icon: 'videocam', color: '#F472B6' },

  // Audio
  mp3: { icon: 'audiotrack', color: '#FBBF24' },
  wav: { icon: 'audiotrack', color: '#FBBF24' },
  flac: { icon: 'audiotrack', color: '#FBBF24' },

  // Archives
  zip: { icon: 'folder_zip', color: '#FACC15' },
  rar: { icon: 'folder_zip', color: '#FACC15' },
  '7z': { icon: 'folder_zip', color: '#FACC15' },
  tar: { icon: 'folder_zip', color: '#FACC15' },
  gz: { icon: 'folder_zip', color: '#FACC15' },

  // Code
  js: { icon: 'code', color: '#7DD3FC' },
  ts: { icon: 'code', color: '#7DD3FC' },
  json: { icon: 'code', color: '#7DD3FC' },
  html: { icon: 'code', color: '#7DD3FC' },
  css: { icon: 'code', color: '#7DD3FC' },
  py: { icon: 'code', color: '#7DD3FC' },
  java: { icon: 'code', color: '#7DD3FC' },
};

const DEFAULT_ICON: FileIconInfo = { icon: 'draft', color: '#8AA8FF' };

export function getFileIcon(filename: string): FileIconInfo {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return DEFAULT_ICON;

  const ext = filename.substring(lastDot + 1).toLowerCase();
  return EXTENSION_MAP[ext] ?? DEFAULT_ICON;
}
