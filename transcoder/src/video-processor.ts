import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { AppConfig } from "./config.js";
import { VideoProbeMetadata } from "./types.js";

async function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

export interface ProcessVideoResult {
  hlsDir: string;
  thumbnailPath: string;
  metadata: VideoProbeMetadata;
}

export class VideoProcessor {
  constructor(private readonly config: AppConfig) {}

  async process(inputPath: string, workdir: string): Promise<ProcessVideoResult> {
    const hlsDir = join(workdir, "hls");
    const thumbnailPath = join(workdir, "thumbnail.jpg");
    const playlistPath = join(hlsDir, "index.m3u8");
    const segmentPattern = join(hlsDir, "segment-%05d.ts");

    await mkdir(hlsDir, { recursive: true });

    const metadata = await this.probe(inputPath);

    await runCommand(this.config.ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-preset",
      "veryfast",
      "-movflags",
      "+faststart",
      "-start_number",
      "0",
      "-hls_time",
      String(this.config.hlsTimeSeconds),
      "-hls_list_size",
      "0",
      "-hls_segment_filename",
      segmentPattern,
      "-f",
      "hls",
      playlistPath,
    ]);

    await runCommand(this.config.ffmpegPath, [
      "-y",
      "-ss",
      String(this.config.thumbnailOffsetSeconds),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      thumbnailPath,
    ]);

    return { hlsDir, thumbnailPath, metadata };
  }

  private async probe(inputPath: string): Promise<VideoProbeMetadata> {
    const output = await runCommand(this.config.ffprobePath, [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-print_format",
      "json",
      inputPath,
    ]);

    const payload = JSON.parse(output) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };

    const videoStream = payload.streams?.find((stream) => stream.codec_type === "video");

    return {
      duration: payload.format?.duration ? Math.round(Number(payload.format.duration)) : undefined,
      width: videoStream?.width,
      height: videoStream?.height,
    };
  }
}
