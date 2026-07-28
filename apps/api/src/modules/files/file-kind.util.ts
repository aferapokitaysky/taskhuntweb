import { FileKind } from '@prisma/client';

const EXECUTABLE_EXT = ['.exe', '.apk', '.ipa', '.msi', '.sh', '.bat'];
const ARCHIVE_EXT = ['.zip', '.rar', '.7z', '.tar', '.gz'];

export function resolveFileKind(mimeType: string, filename: string): FileKind {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (EXECUTABLE_EXT.includes(ext)) return 'EXECUTABLE';
  if (ARCHIVE_EXT.includes(ext)) return 'ARCHIVE';
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/') || mimeType.includes('document')) {
    return 'DOCUMENT';
  }
  return 'OTHER';
}
