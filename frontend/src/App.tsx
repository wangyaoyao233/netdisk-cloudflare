import { useState, useRef, useEffect } from 'react'
import { Upload, Download, File as FileIcon, X, HardDrive, Search, Plus, FileText, Image as ImageIcon, Archive, MoreVertical, ChevronRight, Folder } from 'lucide-react'
import { FileService, type FileItem } from './api/fileService'

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string>('root');
  const [pathStack, setPathStack] = useState<{id: string, name: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化加载文件列表
  useEffect(() => {
    fetchFiles(currentParentId);
  }, [currentParentId]);

  const fetchFiles = async (parentId: string) => {
    setLoading(true);
    try {
      const data = await FileService.getFiles(parentId);
      setFiles(data);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      // 1. 获取预签名 URL
      // 后端现在会返回它用来签名的 contentType
      const { id, uploadUrl, r2Key, contentType } = await FileService.getUploadUrl(file.name, file.size, file.type, currentParentId);
      
      // 2. 上传到 R2
      // 必须传递签名时使用的 contentType
      await FileService.uploadToR2(uploadUrl, file, contentType);
      
      // 3. 上传成功后，通知后端保存元数据到 D1
      await FileService.createFileRecord({
        id,
        parentId: currentParentId,
        name: file.name,
        size: file.size,
        contentType: contentType || file.type,
        r2Key
      });
      
      // 4. 刷新列表
      fetchFiles(currentParentId);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await FileService.deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (file.type === 'folder') return;
    try {
      const { url } = await FileService.getDownloadUrl(file.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name) return;
    try {
      await FileService.createFolder(name, currentParentId);
      fetchFiles(currentParentId);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleEnterFolder = (folder: FileItem) => {
    if (folder.type !== 'folder') return;
    setPathStack(prev => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentParentId(folder.id);
  };

  const handleNavigateBack = (index: number) => {
    if (index === -1) {
      setPathStack([]);
      setCurrentParentId('root');
    } else {
      const newStack = pathStack.slice(0, index + 1);
      setPathStack(newStack);
      setCurrentParentId(newStack[newStack.length - 1].id);
    }
  };

  const handleGoUp = () => {
    if (pathStack.length === 0) return;
    handleNavigateBack(pathStack.length - 2);
  };

  const getFileIcon = (file: FileItem) => {
    if (file.type === 'folder') return <Folder className="w-5 h-5 text-indigo-500 fill-indigo-50" />;
    
    const t = (file.contentType || '').toUpperCase();
    if (t.includes('PDF')) return <FileText className="w-5 h-5 text-red-500" />;
    if (t.includes('IMAGE') || ['JPG', 'PNG', 'WEBP'].includes(t)) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (t.includes('ZIP') || t.includes('ARCHIVE') || t.includes('OCTET-STREAM')) return <Archive className="w-5 h-5 text-amber-500" />;
    return <FileIcon className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Full page drag overlay */}
      {dragActive && (
        <div 
          className="fixed inset-0 z-50 bg-indigo-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 transition-all duration-300"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="p-8 rounded-full bg-white/20 border-4 border-dashed border-white/40 animate-pulse">
            <Upload className="w-20 h-20" />
          </div>
          <h2 className="mt-8 text-3xl font-bold">Drop to Upload</h2>
          <p className="mt-2 text-indigo-100 text-lg text-center">
            Files will be uploaded to <strong>{pathStack.length > 0 ? pathStack[pathStack.length-1].name : 'Root'}</strong>
          </p>
        </div>
      )}

      {/* Header */}
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

      <main 
        className="max-w-6xl mx-auto px-6 py-10 space-y-8"
        onDragEnter={handleDrag}
      >
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm font-medium text-slate-500 overflow-x-auto whitespace-nowrap pb-2">
          <button 
            onClick={() => handleNavigateBack(-1)}
            className={`hover:text-indigo-600 transition-colors ${currentParentId === 'root' ? 'text-indigo-600 font-bold' : ''}`}
          >
            My Files
          </button>
          {pathStack.map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <button 
                onClick={() => handleNavigateBack(index)}
                className={`hover:text-indigo-600 transition-colors ${index === pathStack.length - 1 ? 'text-indigo-600 font-bold' : ''}`}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </nav>

        {/* File Browser Section */}
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
                  onClick={handleCreateFolder}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Folder</span>
                </button>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  className="hidden" 
                  onChange={handleChange}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
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
                      onDoubleClick={handleGoUp}
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
                  ) : files.map((file) => (
                    <tr 
                      key={file.id} 
                      onDoubleClick={() => handleEnterFolder(file)}
                      className={`hover:bg-slate-50/80 transition-all group cursor-default ${file.type === 'folder' ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="bg-slate-50 p-2.5 rounded-xl transition-colors group-hover:bg-white group-hover:shadow-sm">
                            {getFileIcon(file)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors truncate">{file.name}</p>
                            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{file.type}</p>
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
                            <button 
                              onClick={() => handleDownload(file)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                    onClick={handleCreateFolder}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-6 py-2.5 rounded-xl transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    New Folder
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
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
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 text-center border-t border-slate-100 mt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-1.5 opacity-40 grayscale">
            <HardDrive className="w-4 h-4" />
            <span className="font-bold text-sm tracking-tighter">CloudNet</span>
          </div>
          <p className="text-slate-400 text-xs">Built with React & Cloudflare Stack (Worker, D1, R2)</p>
        </div>
      </footer>
    </div>
  )
}

export default App
