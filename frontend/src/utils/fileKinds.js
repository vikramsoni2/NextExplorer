// Centralized file kind → human label helpers

// Images
const imageMap = {
  jpg: 'JPEG image',
  jpeg: 'JPEG image',
  png: 'PNG image',
  gif: 'GIF image',
  webp: 'WebP image',
  svg: 'SVG image',
  heic: 'HEIC image',
  heif: 'HEIF image',
  bmp: 'Bitmap image',
  tiff: 'TIFF image',
  tif: 'TIFF image',
  avif: 'AVIF image',
};

// Video
const videoMap = {
  mp4: 'MP4 video',
  mov: 'MOV video',
  mkv: 'MKV video',
  webm: 'WebM video',
  avi: 'AVI video',
  m4v: 'M4V video',
};

// Audio
const audioMap = {
  mp3: 'MP3 audio',
  wav: 'WAV audio',
  flac: 'FLAC audio',
  aac: 'AAC audio',
  m4a: 'M4A audio',
  ogg: 'OGG audio',
  opus: 'OPUS audio',
  wma: 'WMA audio',
};

// Archives
const archiveMap = {
  zip: 'ZIP archive',
  rar: 'RAR archive',
  '7z': '7z archive',
  tar: 'TAR archive',
  gz: 'GZip archive',
  bz2: 'Bzip2 archive',
  xz: 'XZ archive',
  tgz: 'TAR.GZ archive',
};

// Documents
const docMap = {
  pdf: 'PDF document',
  txt: 'Plain text document',
  rtf: 'Rich text document',
  md: 'Markdown document',
  markdown: 'Markdown document',
  csv: 'CSV document',
  doc: 'Word document',
  docx: 'Word document',
  xls: 'Excel spreadsheet',
  xlsx: 'Excel spreadsheet',
  ppt: 'PowerPoint presentation',
  pptx: 'PowerPoint presentation',
};

// Web & code
const codeMap = {
  html: 'HTML document',
  htm: 'HTML document',
  css: 'CSS stylesheet',
  scss: 'SCSS stylesheet',
  less: 'LESS stylesheet',
  js: 'JavaScript source',
  jsx: 'JavaScript source',
  ts: 'TypeScript source',
  tsx: 'TypeScript source',
  json: 'JSON document',
  yml: 'YAML document',
  yaml: 'YAML document',
  xml: 'XML document',
  sh: 'Shell script',
  bash: 'Shell script',
  zsh: 'Shell script',
  py: 'Python script',
  rb: 'Ruby script',
  php: 'PHP script',
  go: 'Go source',
  rs: 'Rust source',
  java: 'Java source',
  kt: 'Kotlin source',
  kts: 'Kotlin script',
  swift: 'Swift source',
  c: 'C source',
  cpp: 'C++ source',
  cc: 'C++ source',
  cxx: 'C++ source',
  cs: 'C# source',
};

// Fonts & vector
const fontMap = {
  ttf: 'TrueType font',
  otf: 'OpenType font',
  woff: 'Web font',
  woff2: 'Web font',
};

// Packages / installers
const pkgMap = {
  exe: 'Windows executable',
  msi: 'Windows installer',
  apk: 'Android package',
  dmg: 'Disk image',
  pkg: 'Package',
  deb: 'Linux package',
  rpm: 'Linux package',
};

// Data & config
const dataMap = {
  db: 'Database file',
  sqlite: 'SQLite database',
  sqlite3: 'SQLite database',
  ini: 'Configuration file',
  conf: 'Configuration file',
  cfg: 'Configuration file',
  toml: 'TOML configuration',
  env: 'Environment file',
  lock: 'Lock file',
  log: 'Log file',
  tmp: 'Temporary file',
  bak: 'Backup file',
};

const LOOKUP_TABLES = [
  imageMap,
  videoMap,
  audioMap,
  archiveMap,
  docMap,
  codeMap,
  fontMap,
  pkgMap,
  dataMap,
];

function labelFromKind(kind, name) {
  const k = String(kind || '').toLowerCase();

  if (k === 'directory') return 'Folder';
  if (k === 'volume') return 'Volume';

  for (const table of LOOKUP_TABLES) {
    if (Object.prototype.hasOwnProperty.call(table, k)) {
      return table[k];
    }
  }

  if (k) return `${k.toUpperCase()} file`;

  const nm = String(name || '');
  const idx = nm.lastIndexOf('.');
  if (idx > 0 && idx < nm.length - 1) {
    const ext = nm.slice(idx + 1).toLowerCase();
    if (ext) return `${ext.toUpperCase()} file`;
  }
  return 'File';
}

function getKindLabel(item) {
  if (!item) return '';
  return labelFromKind(item.kind, item.name);
}

export {
  getKindLabel,
  labelFromKind,
  // export tables for potential reuse/testing
  imageMap,
  videoMap,
  audioMap,
  archiveMap,
  docMap,
  codeMap,
  fontMap,
  pkgMap,
  dataMap,
};
