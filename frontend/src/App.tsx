import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { FileService, type FileItem } from './api/fileService'
import { Breadcrumbs } from './components/Breadcrumbs'
import { DragUploadOverlay } from './components/DragUploadOverlay'
import { FileBrowser } from './components/file-browser/FileBrowser'
import { AppDialog, type AppDialogState } from './components/feedback/AppDialog'
import { ToastViewport, type ToastMessage } from './components/feedback/ToastViewport'
import { AppFooter } from './components/layout/AppFooter'
import { AppHeader } from './components/layout/AppHeader'
import { ImagePreviewModal } from './components/modals/ImagePreviewModal'
import { VideoPlayerModal } from './components/modals/VideoPlayerModal'
import { useFolderFiles } from './hooks/useFolderFiles'
import { useHlsVideo } from './hooks/useHlsVideo'
import { isImageFile, isVideoFile } from './utils/fileMedia'
import { readFolderLocationFromUrl, writeFolderLocationToUrl, type FolderPathItem } from './utils/navigationState'

function App() {
  const initialLocation = readFolderLocationFromUrl();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentParentId, setCurrentParentId] = useState<string>(initialLocation.currentParentId);
  const [pathStack, setPathStack] = useState<FolderPathItem[]>(initialLocation.pathStack);
  const [previewFile, setPreviewFile] = useState<{url: string, name: string} | null>(null);
  const [videoFile, setVideoFile] = useState<FileItem | null>(null);
  const [dialog, setDialog] = useState<AppDialogState | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);
  const modalOpen = Boolean(previewFile || videoFile || dialog);

  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToasts(prev => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id));
    }, 4500);
  };

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useHlsVideo(videoFile, videoRef);

  const {
    files,
    loading,
    loadFiles,
    updateFolderCache,
    clearFolderCache,
  } = useFolderFiles({
    onLoadError: ({ error }) => {
      console.error('Failed to fetch files:', error);
      showToast({
        tone: 'error',
        title: 'Unable to load files',
        message: 'Please refresh or check the service connection.',
      });
    },
  });

  useEffect(() => {
    loadFiles(currentParentId);
  }, [currentParentId, loadFiles]);

  useEffect(() => {
    const handlePopState = () => {
      const nextLocation = readFolderLocationFromUrl();
      setCurrentParentId(nextLocation.currentParentId);
      setPathStack(nextLocation.pathStack);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const originalUserSelect = document.body.style.userSelect;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.body.style.userSelect = 'none';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      document.body.style.userSelect = originalUserSelect;
    };
  }, [modalOpen]);

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

      await loadFiles(currentParentId, { force: true });
    } catch (error) {
      console.error('Upload failed:', error);
      showToast({
        tone: 'error',
        title: 'Upload failed',
        message: 'Check the file and try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const item = files.find(file => file.id === id);
    setDialog({
      type: 'confirm',
      title: 'Delete item',
      message: item ? `Delete "${item.name}"? This action cannot be undone.` : 'Delete this item? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await FileService.deleteFile(id);
          updateFolderCache(currentParentId, prev => prev.filter(file => file.id !== id));
          if (item?.type === 'folder') {
            clearFolderCache(item.id);
          }
          showToast({
            tone: 'success',
            title: 'Item deleted',
            message: item ? `"${item.name}" was removed.` : undefined,
          });
        } catch (error) {
          console.error('Delete failed:', error);
          showToast({
            tone: 'error',
            title: 'Delete failed',
            message: 'The item was not removed. Try again in a moment.',
          });
        }
      },
    });
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
      showToast({
        tone: 'error',
        title: 'Download failed',
        message: 'Could not create a download link for this file.',
      });
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
        showToast({
          tone: 'error',
          title: 'Video processing failed',
          message: file.videoError || 'The transcoder reported a failure for this file.',
        });
        return;
      }

      showToast({
        tone: 'info',
        title: 'Video is still processing',
        message: 'Refresh the file list in a moment.',
      });
      return;
    }

    if (isImageFile(file)) {
      try {
        const { url } = await FileService.getPreviewUrl(file.id);
        setPreviewFile({ url, name: file.name });
      } catch (error) {
        console.error('Preview failed:', error);
        showToast({
          tone: 'error',
          title: 'Preview failed',
          message: 'Could not load a preview for this file.',
        });
      }
    } else {
      handleDownload(file);
    }
  };

  const handleCreateFolder = async () => {
    setDialog({
      type: 'input',
      title: 'New folder',
      message: 'Create a folder in the current directory.',
      placeholder: 'Folder name',
      confirmLabel: 'Create folder',
      onConfirm: async (name: string) => {
        try {
          await FileService.createFolder(name, currentParentId);
          await loadFiles(currentParentId, { force: true });
          showToast({
            tone: 'success',
            title: 'Folder created',
            message: `"${name}" is ready.`,
          });
        } catch (error) {
          console.error('Failed to create folder:', error);
          showToast({
            tone: 'error',
            title: 'Folder creation failed',
            message: 'Choose another name or try again.',
          });
        }
      },
    });
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

      <AppDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
      />

      <ToastViewport
        toasts={toasts}
        onDismiss={dismissToast}
      />

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
          onRefresh={() => loadFiles(currentParentId, { force: true })}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      </main>

      <AppFooter />
    </div>
  )
}

export default App
