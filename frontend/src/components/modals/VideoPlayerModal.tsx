import { Download, X } from 'lucide-react'
import type { RefObject } from 'react'
import type { FileItem } from '../../api/fileService'

interface VideoPlayerModalProps {
  file: FileItem;
  videoRef: RefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
}

export function VideoPlayerModal({ file, videoRef, onClose, onDownload }: VideoPlayerModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
      <button
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>
      <div className="w-full max-w-5xl flex flex-col gap-4">
        <video
          ref={videoRef}
          controls
          playsInline
          className="w-full max-h-[78vh] bg-black rounded-lg shadow-2xl"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{file.name}</p>
            <p className="text-slate-300 text-xs">
              {[file.duration ? `${file.duration}s` : null, file.width && file.height ? `${file.width}x${file.height}` : null].filter(Boolean).join(' / ') || 'HLS'}
            </p>
          </div>
          <button
            onClick={() => onDownload(file)}
            className="flex items-center justify-center gap-2 text-sm font-semibold text-white hover:bg-white/15 bg-white/10 border border-white/10 px-4 py-2 rounded-lg transition-all"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
