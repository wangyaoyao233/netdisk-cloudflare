import { Download, Eye, Folder, MoreVertical, PlayCircle, Plus, RefreshCw, Search, Upload, X } from 'lucide-react'
import type { ChangeEvent, RefObject } from 'react'
import { FileService, type FileItem } from '../../api/fileService'
import { getFileIcon, getVideoStatusLabel } from '../../utils/fileMedia'
import { FileThumbnail } from './FileThumbnail'

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
  onDelete,
}: FileBrowserProps) {
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
                  onDoubleClick={onGoUp}
                  className="hover:bg-slate-50/80 transition-all group cursor-pointer"
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
                    onClick={() => onPreview(file)}
                    onDoubleClick={() => onEnterFolder(file)}
                    className="hover:bg-slate-50/80 transition-all group cursor-pointer"
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
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {file.type === 'file' && (
                          <>
                            <button
                              onClick={(event) => { event.stopPropagation(); onPreview(file); }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Preview"
                            >
                              {file.videoStatus === 'completed' ? <PlayCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            {(file.videoStatus === 'pending' || file.videoStatus === 'processing') && (
                              <button
                                onClick={(event) => { event.stopPropagation(); onRefresh(); }}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Refresh"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(event) => { event.stopPropagation(); onDownload(file); }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(event) => { event.stopPropagation(); onDelete(file.id); }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all" onClick={event => event.stopPropagation()}>
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
