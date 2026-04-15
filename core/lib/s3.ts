import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { gunzipSync, gzipSync } from "node:zlib";
import type { S3ClientConfig } from "@aws-sdk/client-s3";
import { env } from "../config";
import { sessionBundleKey, sessionPrefix } from "./s3-keys";
import { compareReplayEnvelopeEvents } from "./replay-event-order";

export function createS3(): S3Client {
  const c = env().s3;
  const cfg: S3ClientConfig = {
    region: c.region,
    credentials:
      c.accessKey && c.secretKey
        ? { accessKeyId: c.accessKey, secretAccessKey: c.secretKey }
        : undefined,
  };
  if (c.endpoint) {
    cfg.endpoint = c.endpoint;
    cfg.forcePathStyle = true;
  }
  return new S3Client(cfg);
}

let _client: S3Client | null = null;
export function s3(): S3Client {
  if (!_client) _client = createS3();
  return _client;
}

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getJsonGzip(bucket: string, key: string): Promise<Record<string, unknown>[]> {
  const out = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await out.Body!.transformToByteArray();
  const json = gunzipSync(Buffer.from(bytes)).toString("utf8");
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) throw new Error("bundle is not a JSON array");
  return parsed as Record<string, unknown>[];
}

export async function putGzipJson(bucket: string, key: string, value: unknown[]): Promise<void> {
  const body = gzipSync(Buffer.from(JSON.stringify(value), "utf8"));
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
      ContentEncoding: "gzip",
    }),
  );
}

export async function putJpeg(bucket: string, key: string, body: Uint8Array): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
    }),
  );
}

export async function presignGet(bucket: string, key: string, expiresMs: number): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3(), cmd, { expiresIn: Math.ceil(expiresMs / 1000) });
}

export async function uploadSessionBundleGzip(
  bucket: string,
  websiteId: string,
  sessionId: string,
  newEvents: Record<string, unknown>[],
  locks: ReturnType<typeof createBundleLocks>,
): Promise<void> {
  if (newEvents.length === 0) return;
  const key = sessionBundleKey(websiteId, sessionId);
  const mu = locks.lockFor(key);
  await mu.runExclusive(async () => {
    let merged: Record<string, unknown>[] = [];
    if (await objectExists(bucket, key)) {
      merged = await getJsonGzip(bucket, key);
    }
    merged = merged.concat(newEvents);
    merged.sort(compareReplayEnvelopeEvents);
    await putGzipJson(bucket, key, merged);
  });
}

/** Serialize read-modify-write per bundle key (same idea as Go fnv shard mutex). */
export function createBundleLocks(shardCount = 32) {
  const mutexes = Array.from({ length: shardCount }, () => new Mutex());
  return {
    lockFor(bundleKey: string) {
      let h = 2166136261;
      for (let i = 0; i < bundleKey.length; i++) {
        h ^= bundleKey.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return mutexes[(h >>> 0) % shardCount]!;
    },
  };
}

class Mutex {
  private tail: Promise<void> = Promise.resolve();
  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(() => fn());
    this.tail = next.then(() => {}).catch(() => {});
    return next;
  }
}

export async function deleteS3Objects(bucket: string, keys: string[]): Promise<void> {
  const uniq = [...new Set(keys.filter(Boolean))];
  const chunk = 1000;
  for (let i = 0; i < uniq.length; i += chunk) {
    const part = uniq.slice(i, i + chunk);
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: part.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

export async function deleteSessionPrefix(bucket: string, websiteId: string, sessionId: string): Promise<void> {
  const prefix = sessionPrefix(websiteId, sessionId);
  let token: string | undefined;
  do {
    const list = await s3().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    const keys = (list.Contents ?? []).map((o) => o.Key).filter(Boolean) as string[];
    if (keys.length > 0) {
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
}

export async function locateBundle(
  bucket: string,
  siteId: string,
  uuidStr: string,
  sessionId: string,
): Promise<string | null> {
  const keys = [sessionBundleKey(siteId, sessionId)];
  if (uuidStr && uuidStr !== siteId) keys.push(sessionBundleKey(uuidStr, sessionId));
  for (const k of keys) {
    if (await objectExists(bucket, k)) return k;
  }
  return null;
}
