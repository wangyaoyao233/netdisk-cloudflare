import { X } from 'lucide-react'

interface ImagePreviewModalProps {
  file: { url: string; name: string };
  onClose: () => void;
}

export function ImagePreviewModal({ file, onClose }: ImagePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-10">
      <button
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>
      <div className="relative max-w-full max-h-full flex flex-col items-center gap-4">
        <img
          src={file.url}
          alt={file.name}
          className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain bg-white/5"
        />
        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
          <p className="text-white font-medium text-sm">{file.name}</p>
        </div>
      </div>
    </div>
  );
}
