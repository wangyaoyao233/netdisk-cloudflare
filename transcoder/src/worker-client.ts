import { AppConfig } from "./config.js";
import { ClaimJobResponse, VideoMetadataPayload } from "./types.js";

function buildHeaders(config: AppConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.workerApiToken) {
    headers.Authorization = `Bearer ${config.workerApiToken}`;
  }

  return headers;
}

export class WorkerClient {
  constructor(private readonly config: AppConfig) {}

  async claimJob(): Promise<ClaimJobResponse | null> {
    const response = await fetch(`${this.config.workerApiBaseUrl}${this.config.workerClaimPath}`, {
      method: "POST",
      headers: buildHeaders(this.config),
      body: JSON.stringify({ workerId: this.config.workerId }),
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Claim job failed (${response.status}): ${body}`);
    }

    return (await response.json()) as ClaimJobResponse;
  }

  async reportResult(itemId: string, payload: VideoMetadataPayload): Promise<void> {
    const path = this.config.workerResultPathTemplate.replace("{itemId}", encodeURIComponent(itemId));
    const response = await fetch(`${this.config.workerApiBaseUrl}${path}`, {
      method: "PATCH",
      headers: buildHeaders(this.config),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Report result failed (${response.status}): ${body}`);
    }
  }
}
