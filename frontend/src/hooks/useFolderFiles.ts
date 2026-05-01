import { useCallback, useRef, useState } from 'react'
import { FileService, type FileItem } from '../api/fileService'

interface FolderLoadErrorContext {
  error: unknown;
  parentId: string;
  hasCachedFiles: boolean;
}

interface UseFolderFilesOptions {
  onLoadError?: (context: FolderLoadErrorContext) => void;
}

interface LoadFilesOptions {
  force?: boolean;
}

export function useFolderFiles({ onLoadError }: UseFolderFilesOptions = {}) {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const folderCacheRef = useRef<Map<string, FileItem[]>>(new Map());
  const folderRequestIdRef = useRef(0);
  const onLoadErrorRef = useRef(onLoadError);

  onLoadErrorRef.current = onLoadError;

  const loadFiles = useCallback(async (parentId: string, options: LoadFilesOptions = {}) => {
    const requestId = folderRequestIdRef.current + 1;
    folderRequestIdRef.current = requestId;
    const cachedFiles = folderCacheRef.current.get(parentId);
    const shouldUseCache = cachedFiles && !options.force;

    if (shouldUseCache) {
      setFiles(cachedFiles);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const data = await FileService.getFiles(parentId);
      folderCacheRef.current.set(parentId, data);
      if (folderRequestIdRef.current !== requestId) return;
      setFiles(data);
    } catch (error) {
      if (folderRequestIdRef.current !== requestId) return;
      if (cachedFiles) {
        setFiles(cachedFiles);
      }
      onLoadErrorRef.current?.({
        error,
        parentId,
        hasCachedFiles: Boolean(cachedFiles),
      });
    } finally {
      if (folderRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  const updateFolderCache = useCallback((parentId: string, updater: (files: FileItem[]) => FileItem[]) => {
    setFiles(prev => {
      const next = updater(folderCacheRef.current.get(parentId) ?? prev);
      folderCacheRef.current.set(parentId, next);
      return next;
    });
  }, []);

  const clearFolderCache = useCallback((parentId: string) => {
    folderCacheRef.current.delete(parentId);
  }, []);

  return {
    files,
    loading,
    loadFiles,
    updateFolderCache,
    clearFolderCache,
  };
}
