import { HardDrive } from 'lucide-react'

interface AppHeaderProps {
  uploading: boolean;
}

export function AppHeader({ uploading }: AppHeaderProps) {
  return (
    <nav className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm shadow-indigo-200">
            <HardDrive className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">CloudNet</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-4 w-[1px] bg-slate-200 hidden md:block"></div>
          <div className="text-xs font-medium text-slate-400 hidden sm:block">
            {uploading ? (
              <span className="flex items-center gap-2 text-indigo-600">
                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                Uploading...
              </span>
            ) : 'Connected to R2'}
          </div>
        </div>
      </div>
    </nav>
  );
}
