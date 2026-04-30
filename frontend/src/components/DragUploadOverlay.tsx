import { Upload } from 'lucide-react'
import type { DragEvent } from 'react'

interface DragUploadOverlayProps {
  currentFolderName: string;
  onDragEvent: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

export function DragUploadOverlay({ currentFolderName, onDragEvent, onDrop }: DragUploadOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-indigo-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 transition-all duration-300"
      onDragEnter={onDragEvent}
      onDragLeave={onDragEvent}
      onDragOver={onDragEvent}
      onDrop={onDrop}
    >
      <div className="p-8 rounded-full bg-white/20 border-4 border-dashed border-white/40 animate-pulse">
        <Upload className="w-20 h-20" />
      </div>
      <h2 className="mt-8 text-3xl font-bold">Drop to Upload</h2>
      <p className="mt-2 text-indigo-100 text-lg text-center">
        Files will be uploaded to <strong>{currentFolderName}</strong>
      </p>
    </div>
  );
}
