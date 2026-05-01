import { HardDrive } from 'lucide-react'

export function AppFooter() {
  return (
    <footer className="max-w-6xl mx-auto px-6 py-12 text-center border-t border-slate-100 mt-12">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-1.5 opacity-40 grayscale">
          <HardDrive className="w-4 h-4" />
          <span className="font-bold text-sm tracking-tighter">CloudNet</span>
        </div>
        <p className="text-slate-400 text-xs">CloudNet by 王雨蒙</p>
      </div>
    </footer>
  );
}
