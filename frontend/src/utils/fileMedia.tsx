import { Archive, File as FileIcon, FileText, Folder, Image as ImageIcon, Video } from 'lucide-react'
import type { FileItem } from '../api/fileService'

export function isImageFile(file: FileItem): boolean {
  return (file.contentType || '').startsWith('image/');
}

export function isVideoFile(file: FileItem): boolean {
  return file.mediaType === 'video' || (file.contentType || '').startsWith('video/');
}

export function getFileIcon(file: FileItem) {
  if (file.type === 'folder') return <Folder className="w-5 h-5 text-indigo-500 fill-indigo-50" />;

  const type = (file.contentType || '').toUpperCase();
  if (type.includes('PDF')) return <FileText className="w-5 h-5 text-red-500" />;
  if (type.includes('IMAGE') || ['JPG', 'PNG', 'WEBP'].includes(type)) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (type.includes('VIDEO')) return <Video className="w-5 h-5 text-emerald-500" />;
  if (type.includes('ZIP') || type.includes('ARCHIVE') || type.includes('OCTET-STREAM')) return <Archive className="w-5 h-5 text-amber-500" />;
  return <FileIcon className="w-5 h-5 text-slate-400" />;
}

export function getVideoStatusLabel(file: FileItem): string | null {
  if (!isVideoFile(file)) return null;
  if (!file.videoStatus) return null;
  if (file.videoStatus === 'completed') return 'Ready to play';
  if (file.videoStatus === 'failed') return 'Processing failed';
  if (file.videoStatus === 'processing') return 'Processing';
  return 'Queued';
}
