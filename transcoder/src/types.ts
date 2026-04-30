export interface ClaimJobResponse {
  jobId: string;
  itemId: string;
  fileName: string;
  sourceR2Key: string;
  contentType?: string;
}

export interface VideoMetadataPayload {
  jobId: string;
  videoStatus: "completed" | "failed";
  hlsPath?: string;
  thumbnailPath?: string;
  duration?: number;
  width?: number;
  height?: number;
  errorMessage?: string;
}

export interface VideoProbeMetadata {
  duration?: number;
  width?: number;
  height?: number;
}
