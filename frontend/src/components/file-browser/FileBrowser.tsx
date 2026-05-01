import { Download, Folder, MoreVertical, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent, RefObject } from 'react'
import { FileService, type FileItem } from '../../api/fileService'
import { getFileIcon, getVideoStatusLabel } from '../../utils/fileMedia'
import { FileThumbnail } from './FileThumbnail'

// Keep this in sync with the tallest action menu until the menu is rendered as a floating layer.
const ACTION_MENU_BOTTOM_SPACE_CLASS = 'h-40';

interface FileBrowserProps {
  files: FileItem[];
  loading: boolean;
  currentParentId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onCreateFolder: () => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadClick: () => void;
  onPreview: (file: FileItem) => void;
  onEnterFolder: (file: FileItem) => void;
  onGoUp: () => void;
  onRefresh: () => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onDelete: (id: string) => void;
}

export function FileBrowser({
  files,
  loading,
  currentParentId,
  fileInputRef,
  onCreateFolder,
  onFileInputChange,
  onUploadClick,
  onPreview,
  onEnterFolder,
  onGoUp,
  onRefresh,
  onDownload,
  onRename,
  onDelete,
}: FileBrowserProps) {
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const dragThreshold = 6;

  useEffect(() => {
    if (!openActionMenuId) return;

    const closeActionMenu = () => setOpenActionMenuId(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeActionMenu();
    };

    document.addEventListener('click', closeActionMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', closeActionMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openActionMenuId]);

  const handleRowPointerDown = (event: PointerEvent<HTMLTableRowElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
  };

  const handleRowPointerMove = (event: PointerEvent<HTMLTableRowElement>) => {
    if (!pointerStartRef.current) return;

    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);
    if (deltaX > dragThreshold || deltaY > dragThreshold) {
      didDragRef.current = true;
    }
  };

  const handleRowClick = (file: FileItem) => {
    if (didDragRef.current) {
      pointerStartRef.current = null;
      didDragRef.current = false;
      return;
    }

    onPreview(file);
  };

  const handleRowDoubleClick = (file: FileItem) => {
    if (didDragRef.current) return;
    onEnterFolder(file);
  };

  const handleParentRowClick = () => {
    if (didDragRef.current) {
      pointerStartRef.current = null;
      didDragRef.current = false;
      return;
    }

    onGoUp();
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Files & Folders</h2>
          <p className="text-slate-500 text-sm font-medium">Manage your cloud storage</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group flex-1 min-w-[200px] sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Quick search..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-full sm:w-64 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCreateFolder}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFileInputChange}
            />
            <button
              onClick={onUploadClick}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-100 active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Name</th>
                <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Size</th>
                <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Created At</th>
                <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentParentId !== 'root' && !loading && (
                <tr
                  onPointerDown={handleRowPointerDown}
                  onPointerMove={handleRowPointerMove}
                  onPointerCancel={() => { pointerStartRef.current = null; }}
                  onClick={handleParentRowClick}
                  className="hover:bg-slate-50/80 transition-all group cursor-pointer select-none"
                >
                  <td className="px-8 py-4" colSpan={4}>
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400 group-hover:text-indigo-500 transition-colors">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">..</p>
                        <p className="text-[10px] text-slate-300 uppercase">Go back to parent</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-sm font-medium">Loading your files...</p>
                    </div>
                  </td>
                </tr>
              ) : files.map((file) => {
                const videoStatusLabel = getVideoStatusLabel(file);

                return (
                  <tr
                    key={file.id}
                    onPointerDown={handleRowPointerDown}
                    onPointerMove={handleRowPointerMove}
                    onPointerCancel={() => { pointerStartRef.current = null; }}
                    onClick={() => handleRowClick(file)}
                    onDoubleClick={() => handleRowDoubleClick(file)}
                    className="hover:bg-slate-50/80 transition-all group cursor-pointer select-none"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <FileThumbnail file={file} fallbackIcon={getFileIcon(file)} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors truncate">{file.name}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{file.type}</p>
                            {videoStatusLabel && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                file.videoStatus === 'completed' ? 'text-emerald-600' :
                                file.videoStatus === 'failed' ? 'text-red-500' :
                                'text-amber-500'
                              }`}>
                                {videoStatusLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-500 font-medium">
                      {file.type === 'file' ? FileService.formatSize(file.size) : '--'}
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-400 font-medium">
                      {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '--'}
                    </td>
                    <td className="relative px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {file.type === 'file' && (
                          <>
                            {(file.videoStatus === 'pending' || file.videoStatus === 'processing') && (
                              <button
                                onClick={(event) => { event.stopPropagation(); onRefresh(); }}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Refresh"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                        <div className="relative">
                          <button
                            type="button"
                            className={`p-2 rounded-lg transition-all ${
                              openActionMenuId === file.id
                                ? 'bg-slate-100 text-slate-700'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                            title="More actions"
                            aria-label={`More actions for ${file.name}`}
                            aria-expanded={openActionMenuId === file.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenActionMenuId(prev => prev === file.id ? null : file.id);
                            }}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionMenuId === file.id && (
                            <div
                              className="absolute right-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl shadow-slate-900/10"
                              onClick={event => event.stopPropagation()}
                            >
                              {file.type === 'file' && (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    onDownload(file);
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </button>
                              )}
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  onRename(file);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Rename
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  onDelete(file.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && files.length > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={4} className={`${ACTION_MENU_BOTTOM_SPACE_CLASS} p-0`}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && files.length === 0 && (
          <div className="py-24 flex flex-col items-center text-center">
            <div className="inline-flex p-8 rounded-full bg-slate-50 text-slate-200 mb-6 border-4 border-white shadow-inner">
              <Folder className="w-16 h-16" />
            </div>
            <h4 className="text-xl font-bold text-slate-800">No items found</h4>
            <p className="text-slate-400 mt-2 max-w-xs mx-auto text-sm mb-8">
              This folder is empty. Start by creating a new folder or uploading some files.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCreateFolder}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-6 py-2.5 rounded-xl transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Folder
              </button>
              <button
                onClick={onUploadClick}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-indigo-100"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>
          </div>
        )}

        <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">{files.length} items in this directory</span>
        </div>
      </div>
    </section>
  );
}
