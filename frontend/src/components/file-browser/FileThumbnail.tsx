import { useState, type ReactNode } from 'react'
import { PlayCircle } from 'lucide-react'
import { FileService, type FileItem } from '../../api/fileService'
import { isImageFile, isVideoFile } from '../../utils/fileMedia'

interface FileThumbnailProps {
  file: FileItem;
  fallbackIcon: ReactNode;
}

export function FileThumbnail({ file, fallbackIcon }: FileThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const isVideo = isVideoFile(file);
  const canShowThumbnail = file.type === 'file' && !failed && (isImageFile(file) || (isVideo && file.videoStatus === 'completed' && file.thumbnailPath));

  if (canShowThumbnail) {
    return (
      <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/70">
        <img
          src={FileService.getThumbnailUrl(file.id)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-emerald-600 shadow-sm">
              <PlayCircle className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex w-14 h-14 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-200/70 transition-colors group-hover:bg-white group-hover:shadow-sm">
      {fallbackIcon}
      {isVideo && file.videoStatus && file.videoStatus !== 'completed' && (
        <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${
          file.videoStatus === 'failed' ? 'bg-red-500' : 'bg-amber-400'
        }`} />
      )}
    </div>
  );
}
