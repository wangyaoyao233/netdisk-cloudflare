import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { FileService, type FileItem } from './api/fileService'
import { Breadcrumbs } from './components/Breadcrumbs'
import { DragUploadOverlay } from './components/DragUploadOverlay'
import { FileBrowser } from './components/file-browser/FileBrowser'
import { AppFooter } from './components/layout/AppFooter'
import { AppHeader } from './components/layout/AppHeader'
import { ImagePreviewModal } from './components/modals/ImagePreviewModal'
import { VideoPlayerModal } from './components/modals/VideoPlayerModal'
import { useHlsVideo } from './hooks/useHlsVideo'
import { isImageFile, isVideoFile } from './utils/fileMedia'
import { readFolderLocationFromUrl, writeFolderLocationToUrl, type FolderPathItem } from './utils/navigationState'

function App() {
  const initialLocation = readFolderLocationFromUrl();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string>(initialLocation.currentParentId);
  const [pathStack, setPathStack] = useState<FolderPathItem[]>(initialLocation.pathStack);
  const [previewFile, setPreviewFile] = useState<{url: string, name: string} | null>(null);
  const [videoFile, setVideoFile] = useState<FileItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useHlsVideo(videoFile, videoRef);

  useEffect(() => {
    fetchFiles(currentParentId);
  }, [currentParentId]);

  useEffect(() => {
    const handlePopState = () => {
      const nextLocation = readFolderLocationFromUrl();
      setCurrentParentId(nextLocation.currentParentId);
      setPathStack(nextLocation.pathStack);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const handleDrag = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFileUpload(event.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (event.target.files && event.target.files[0]) {
      handleFileUpload(event.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const { id, uploadUrl, r2Key, contentType } = await FileService.getUploadUrl(file.name, file.size, file.type, currentParentId);

      await FileService.uploadToR2(uploadUrl, file, contentType);

      await FileService.createFileRecord({
        id,
        parentId: currentParentId,
        name: file.name,
        size: file.size,
        contentType: contentType || file.type,
        r2Key
      });

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
      setFiles(prev => prev.filter(file => file.id !== id));
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

  const handlePreview = async (file: FileItem) => {
    if (file.type === 'folder') {
      handleEnterFolder(file);
      return;
    }

    if (isVideoFile(file)) {
      if (file.videoStatus === 'completed') {
        setVideoFile(file);
        return;
      }

      if (file.videoStatus === 'failed') {
        alert(file.videoError || 'Video processing failed.');
        return;
      }

      alert('Video is still processing. Refresh the file list in a moment.');
      return;
    }

    if (isImageFile(file)) {
      try {
        const { url } = await FileService.getPreviewUrl(file.id);
        setPreviewFile({ url, name: file.name });
      } catch (error) {
        console.error('Preview failed:', error);
      }
    } else {
      handleDownload(file);
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
    const nextPathStack = [...pathStack, { id: folder.id, name: folder.name }];
    writeFolderLocationToUrl({ currentParentId: folder.id, pathStack: nextPathStack });
    setPathStack(nextPathStack);
    setCurrentParentId(folder.id);
  };

  const handleNavigateBack = (index: number) => {
    if (index === -1) {
      writeFolderLocationToUrl({ currentParentId: 'root', pathStack: [] });
      setPathStack([]);
      setCurrentParentId('root');
    } else {
      const newStack = pathStack.slice(0, index + 1);
      writeFolderLocationToUrl({ currentParentId: newStack[newStack.length - 1].id, pathStack: newStack });
      setPathStack(newStack);
      setCurrentParentId(newStack[newStack.length - 1].id);
    }
  };

  const handleGoUp = () => {
    if (pathStack.length === 0) return;
    handleNavigateBack(pathStack.length - 2);
  };

  const currentFolderName = pathStack.length > 0 ? pathStack[pathStack.length - 1].name : 'Root';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100">
      {dragActive && (
        <DragUploadOverlay
          currentFolderName={currentFolderName}
          onDragEvent={handleDrag}
          onDrop={handleDrop}
        />
      )}

      {previewFile && (
        <ImagePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {videoFile && (
        <VideoPlayerModal
          file={videoFile}
          videoRef={videoRef}
          onClose={() => setVideoFile(null)}
          onDownload={handleDownload}
        />
      )}

      <AppHeader uploading={uploading} />

      <main
        className="max-w-6xl mx-auto px-6 py-10 space-y-8"
        onDragEnter={handleDrag}
      >
        <Breadcrumbs
          currentParentId={currentParentId}
          pathStack={pathStack}
          onNavigate={handleNavigateBack}
        />

        <FileBrowser
          files={files}
          loading={loading}
          currentParentId={currentParentId}
          fileInputRef={fileInputRef}
          onCreateFolder={handleCreateFolder}
          onFileInputChange={handleFileInputChange}
          onUploadClick={() => fileInputRef.current?.click()}
          onPreview={handlePreview}
          onEnterFolder={handleEnterFolder}
          onGoUp={handleGoUp}
          onRefresh={() => fetchFiles(currentParentId)}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      </main>

      <AppFooter />
    </div>
  )
}

export default App
