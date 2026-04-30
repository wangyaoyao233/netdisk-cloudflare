export interface FolderPathItem {
  id: string;
  name: string;
}

export interface FolderLocationState {
  currentParentId: string;
  pathStack: FolderPathItem[];
}

const FOLDER_PARAM = 'folder';
const PATH_PARAM = 'path';

function isFolderPathItem(value: unknown): value is FolderPathItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.name === 'string';
}

export function readFolderLocationFromUrl(): FolderLocationState {
  const params = new URLSearchParams(window.location.search);
  const currentParentId = params.get(FOLDER_PARAM) || 'root';
  const encodedPath = params.get(PATH_PARAM);

  if (!encodedPath || currentParentId === 'root') {
    return { currentParentId: 'root', pathStack: [] };
  }

  try {
    const parsedPath = JSON.parse(decodeURIComponent(encodedPath));
    if (Array.isArray(parsedPath) && parsedPath.every(isFolderPathItem)) {
      return { currentParentId, pathStack: parsedPath };
    }
  } catch (error) {
    console.error('Failed to read folder path from URL:', error);
  }

  return { currentParentId: 'root', pathStack: [] };
}

export function writeFolderLocationToUrl({ currentParentId, pathStack }: FolderLocationState) {
  const url = new URL(window.location.href);

  if (currentParentId === 'root' || pathStack.length === 0) {
    url.searchParams.delete(FOLDER_PARAM);
    url.searchParams.delete(PATH_PARAM);
  } else {
    url.searchParams.set(FOLDER_PARAM, currentParentId);
    url.searchParams.set(PATH_PARAM, encodeURIComponent(JSON.stringify(pathStack)));
  }

  window.history.pushState(null, '', url);
}
