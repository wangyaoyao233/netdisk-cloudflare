import { rm } from "node:fs/promises";
import { setTimeout as sleepTimeout } from "node:timers/promises";

export function sleep(ms: number) {
  return sleepTimeout(ms);
}

export async function safeRemove(path: string) {
  await rm(path, { recursive: true, force: true });
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function detectContentType(path: string): string {
  if (path.endsWith(".m3u8")) {
    return "application/vnd.apple.mpegurl";
  }

  if (path.endsWith(".ts")) {
    return "video/mp2t";
  }

  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}
