import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { pipeline } from "node:stream/promises";

import { AppConfig } from "./config.js";
import { detectContentType } from "./utils.js";

export class R2Storage {
  private readonly client: S3Client;

  constructor(private readonly config: AppConfig) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
  }

  async downloadObject(key: string, destinationPath: string): Promise<void> {
    await mkdir(dirname(destinationPath), { recursive: true });

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.r2BucketName,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`R2 object body is empty: ${key}`);
    }

    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destinationPath));
  }

  async uploadFile(localPath: string, objectKey: string): Promise<void> {
    const body = await readFile(localPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.r2BucketName,
        Key: objectKey,
        Body: body,
        ContentType: detectContentType(localPath),
      }),
    );
  }

  async uploadDirectory(localDir: string, keyPrefix: string): Promise<void> {
    const entries = await readdir(localDir, { recursive: true, withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const localPath = join(entry.parentPath, entry.name);
      const relativePath = relative(localDir, localPath).replaceAll("\\", "/");
      await this.uploadFile(localPath, `${keyPrefix}/${relativePath}`);
    }
  }
}
