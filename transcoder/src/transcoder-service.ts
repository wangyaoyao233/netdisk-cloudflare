import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { AppConfig } from "./config.js";
import { logger } from "./logger.js";
import { R2Storage } from "./r2-storage.js";
import { ClaimJobResponse } from "./types.js";
import { sanitizeFileName, safeRemove, sleep } from "./utils.js";
import { VideoProcessor } from "./video-processor.js";
import { WorkerClient } from "./worker-client.js";

export class TranscoderService {
  constructor(
    private readonly config: AppConfig,
    private readonly workerClient: WorkerClient,
    private readonly storage: R2Storage,
    private readonly processor: VideoProcessor,
  ) {}

  async start(): Promise<void> {
    logger.info("Transcoder service started", {
      workerId: this.config.workerId,
      workerApiBaseUrl: this.config.workerApiBaseUrl,
      pollIntervalMs: this.config.pollIntervalMs,
    });

    for (;;) {
      try {
        const job = await this.workerClient.claimJob();
        if (!job) {
          logger.info("No pending media job");
          await sleep(this.config.idleIntervalMs);
          continue;
        }

        await this.handleJob(job);
        await sleep(this.config.pollIntervalMs);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Polling loop failed", { error: message });
        await sleep(this.config.errorIntervalMs);
      }
    }
  }

  private async handleJob(job: ClaimJobResponse): Promise<void> {
    const workdir = join(this.config.tempDir, `${job.itemId}-${job.jobId}`);
    const inputPath = join(workdir, sanitizeFileName(job.fileName));
    const hlsPath = `hls/${job.itemId}/index.m3u8`;
    const thumbnailPath = `thumbnails/${job.itemId}.jpg`;

    logger.info("Processing media job", {
      jobId: job.jobId,
      itemId: job.itemId,
      fileName: job.fileName,
    });

    await mkdir(workdir, { recursive: true });

    try {
      await this.storage.downloadObject(job.sourceR2Key, inputPath);

      const result = await this.processor.process(inputPath, workdir);

      await this.storage.uploadDirectory(result.hlsDir, `hls/${job.itemId}`);
      await this.storage.uploadFile(result.thumbnailPath, thumbnailPath);

      await this.workerClient.reportResult(job.itemId, {
        jobId: job.jobId,
        videoStatus: "completed",
        hlsPath,
        thumbnailPath,
        duration: result.metadata.duration,
        width: result.metadata.width,
        height: result.metadata.height,
      });

      logger.info("Media job completed", {
        jobId: job.jobId,
        itemId: job.itemId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Media job failed", {
        jobId: job.jobId,
        itemId: job.itemId,
        error: message,
      });

      try {
        await this.workerClient.reportResult(job.itemId, {
          jobId: job.jobId,
          videoStatus: "failed",
          errorMessage: message,
        });
      } catch (reportError) {
        const reportMessage =
          reportError instanceof Error ? reportError.message : String(reportError);

        logger.error("Failed to report media job failure", {
          jobId: job.jobId,
          itemId: job.itemId,
          error: reportMessage,
        });
      }
    } finally {
      if (!this.config.keepWorkdir) {
        await safeRemove(workdir);
      }
    }
  }
}
