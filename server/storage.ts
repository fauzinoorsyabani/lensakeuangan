import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type StorageDriver = "s3" | "forge";

function normalizeKey(relKey: string) {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function storageDriver(): StorageDriver {
  if (process.env.STORAGE_DRIVER === "s3") return "s3";
  if (ENV.forgeApiUrl && ENV.forgeApiKey) return "forge";
  return "s3";
}

function getS3Config() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Storage S3 belum dikonfigurasi. Set S3_BUCKET, S3_ACCESS_KEY_ID, dan S3_SECRET_ACCESS_KEY.");
  }
  return { bucket, accessKeyId, secretAccessKey, region: process.env.S3_REGION || "auto", endpoint: process.env.S3_ENDPOINT };
}

let s3: S3Client | null = null;
function getS3Client() {
  const config = getS3Config();
  if (!s3) {
    s3 = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: Boolean(config.endpoint),
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  return { client: s3, bucket: config.bucket };
}

function getForgeConfig() {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("Storage Forge tidak dikonfigurasi.");
  return { forgeUrl: ENV.forgeApiUrl.replace(/\/+$/, ""), forgeKey: ENV.forgeApiKey };
}

async function forgeSignedUrl(key: string, operation: "put" | "get") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const url = new URL(`v1/storage/presign/${operation}`, `${forgeUrl}/`);
  url.searchParams.set("path", key);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!response.ok) throw new Error(`Storage Forge gagal (${response.status})`);
  const payload = await response.json() as { url?: string };
  if (!payload.url) throw new Error("Storage Forge tidak mengembalikan URL.");
  return payload.url;
}

export function getReceiptImagePath(storageKey: string) {
  return `/api/storage/${encodeURIComponent(normalizeKey(storageKey)).replace(/%2F/g, "/")}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  if (storageDriver() === "s3") {
    const { client, bucket } = getS3Client();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
  } else {
    const signedUrl = await forgeSignedUrl(key, "put");
    const payload = typeof data === "string" ? data : data as Uint8Array;
    const response = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: payload as BodyInit });
    if (!response.ok) throw new Error(`Upload storage gagal (${response.status})`);
  }
  return { key, url: getReceiptImagePath(key) };
}

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  if (storageDriver() === "s3") {
    const { client, bucket } = getS3Client();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  }
  return forgeSignedUrl(key, "get");
}
