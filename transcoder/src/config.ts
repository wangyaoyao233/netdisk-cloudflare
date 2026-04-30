import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Environment variable ${name} must be a positive number`);
  }

  return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return raw === "1" || raw.toLowerCase() === "true";
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export interface AppConfig {
  workerApiBaseUrl: string;
  workerClaimPath: string;
  workerResultPathTemplate: string;
  workerApiToken?: string;
  workerId: string;
  pollIntervalMs: number;
  idleIntervalMs: number;
  errorIntervalMs: number;
  tempDir: string;
  keepWorkdir: boolean;
  ffmpegPath: string;
  ffprobePath: string;
  hlsTimeSeconds: number;
  thumbnailOffsetSeconds: number;
  r2BucketName: string;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
}

export function loadConfig(): AppConfig {
  const tempDir = resolve(process.cwd(), process.env.TRANSCODER_TEMP_DIR || ".tmp");
  mkdirSync(tempDir, { recursive: true });

  const accountId = requireEnv("R2_ACCOUNT_ID");

  return {
    workerApiBaseUrl: trimTrailingSlash(requireEnv("WORKER_API_BASE_URL")),
    workerClaimPath: process.env.WORKER_CLAIM_PATH || "/api/media/jobs/claim",
    workerResultPathTemplate:
      process.env.WORKER_RESULT_PATH_TEMPLATE || "/api/items/{itemId}/video-metadata",
    workerApiToken: process.env.WORKER_API_TOKEN || undefined,
    workerId: process.env.TRANSCODER_WORKER_ID || "mac-mini-01",
    pollIntervalMs: readNumber("TRANSCODER_POLL_INTERVAL_MS", 5000),
    idleIntervalMs: readNumber("TRANSCODER_IDLE_INTERVAL_MS", 10000),
    errorIntervalMs: readNumber("TRANSCODER_ERROR_INTERVAL_MS", 30000),
    tempDir,
    keepWorkdir: readBoolean("TRANSCODER_KEEP_WORKDIR", false),
    ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
    hlsTimeSeconds: readNumber("HLS_TIME_SECONDS", 10),
    thumbnailOffsetSeconds: readNumber("THUMBNAIL_OFFSET_SECONDS", 1),
    r2BucketName: requireEnv("R2_BUCKET_NAME"),
    r2Endpoint:
      trimTrailingSlash(process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`),
    r2AccessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  };
}
