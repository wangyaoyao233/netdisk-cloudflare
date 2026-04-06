export interface FileItem {
  id: string;
  parentId: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  contentType?: string;
  r2Key?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadUrlResponse {
  id: string;
  uploadUrl: string;
  r2Key: string;
}

export interface DownloadUrlResponse {
  url: string;
}

/**
 * 文件服务 API 类
 * 对接 Cloudflare Worker 后端
 */
export class FileService {
  private static readonly API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

  /**
   * 获取文件列表
   * @param parentId 父目录 ID，默认为 'root'
   */
  static async getFiles(parentId: string = 'root'): Promise<FileItem[]> {
    const response = await fetch(`${this.API_BASE}/items?parentId=${parentId}`);
    if (!response.ok) throw new Error('Failed to fetch files');
    return response.json();
  }

  /**
   * 获取文件上传链接 (Presigned URL)
   */
  static async getUploadUrl(name: string, size: number, contentType: string, parentId: string = 'root'): Promise<UploadUrlResponse> {
    const response = await fetch(`${this.API_BASE}/items/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, size, contentType, parentId })
    });
    if (!response.ok) throw new Error('Failed to get upload URL');
    return response.json();
  }

  /**
   * 获取文件下载链接 (Presigned URL)
   */
  static async getDownloadUrl(id: string): Promise<DownloadUrlResponse> {
    const response = await fetch(`${this.API_BASE}/items/${id}/download`);
    if (!response.ok) throw new Error('Failed to get download URL');
    return response.json();
  }

  /**
   * 创建文件夹
   */
  static async createFolder(name: string, parentId: string = 'root'): Promise<FileItem> {
    const response = await fetch(`${this.API_BASE}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId })
    });
    if (!response.ok) throw new Error('Failed to create folder');
    return response.json();
  }

  /**
   * 执行真实的文件上传 (上传到 R2)
   */
  static async uploadToR2(url: string, file: File): Promise<void> {
    const response = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    if (!response.ok) throw new Error('Failed to upload to R2');
  }

  /**
   * 删除文件或文件夹
   */
  static async deleteFile(id: string): Promise<void> {
    const response = await fetch(`${this.API_BASE}/items/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete item');
  }

  /**
   * 格式化文件大小
   */
  static formatSize(bytes?: number): string {
    if (bytes === undefined || bytes === null) return '-';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
