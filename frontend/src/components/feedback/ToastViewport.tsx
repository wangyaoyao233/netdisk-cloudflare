import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export interface ToastMessage {
  id: number;
  title: string;
  message?: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const toneStyles = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
  error: {
    icon: AlertCircle,
    className: 'border-red-100 bg-red-50 text-red-700',
  },
  info: {
    icon: Info,
    className: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  },
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
      {toasts.map(toast => {
        const tone = toneStyles[toast.tone];
        const Icon = tone.icon;

        return (
          <div
            key={toast.id}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10"
            role="status"
          >
            <div className={`shrink-0 rounded-xl border p-2 ${tone.className}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="max-w-full text-sm font-bold text-slate-900 [overflow-wrap:anywhere]">{toast.title}</p>
              {toast.message && <p className="mt-1 max-w-full text-sm leading-5 text-slate-500 [overflow-wrap:anywhere]">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
