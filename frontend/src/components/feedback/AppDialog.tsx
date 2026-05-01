import { AlertTriangle, FolderPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export type AppDialogState =
  | {
      type: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      tone?: 'danger' | 'primary';
      onConfirm: () => void | Promise<void>;
    }
  | {
      type: 'input';
      title: string;
      message: string;
      placeholder?: string;
      initialValue?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm: (value: string) => void | Promise<void>;
    };

interface AppDialogProps {
  dialog: AppDialogState | null;
  onClose: () => void;
}

export function AppDialog({ dialog, onClose }: AppDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setInputValue(dialog?.type === 'input' ? dialog.initialValue ?? '' : '');
    setSubmitting(false);
  }, [dialog]);

  if (!dialog) return null;

  const isInput = dialog.type === 'input';
  const isDanger = dialog.type === 'confirm' && dialog.tone === 'danger';
  const confirmLabel = dialog.confirmLabel ?? (isInput ? 'Create' : 'Confirm');
  const cancelLabel = dialog.cancelLabel ?? 'Cancel';
  const canSubmit = !isInput || inputValue.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (isInput) {
        await dialog.onConfirm(inputValue.trim());
      } else {
        await dialog.onConfirm();
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex select-none items-center justify-center bg-slate-950/40 px-4 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
          <div className={`rounded-2xl p-3 ${isDanger ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
            {isInput ? <FolderPlus className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">{dialog.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{dialog.message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isInput && (
          <div className="px-6 pt-5">
            <input
              autoFocus
              value={inputValue}
              onChange={event => setInputValue(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={dialog.placeholder}
              className="w-full select-text rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              isDanger
                ? 'bg-red-600 shadow-red-100 hover:bg-red-700'
                : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'
            }`}
          >
            {submitting ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
