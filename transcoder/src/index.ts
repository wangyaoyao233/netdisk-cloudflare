import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { R2Storage } from "./r2-storage.js";
import { TranscoderService } from "./transcoder-service.js";
import { VideoProcessor } from "./video-processor.js";
import { WorkerClient } from "./worker-client.js";

async function main() {
  const config = loadConfig();
  const workerClient = new WorkerClient(config);
  const storage = new R2Storage(config);
  const processor = new VideoProcessor(config);
  const service = new TranscoderService(config, workerClient, storage, processor);

  await service.start();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Transcoder service boot failed", { error: message });
  process.exitCode = 1;
});
