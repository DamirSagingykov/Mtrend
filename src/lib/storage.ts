import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env";

/**
 * Хранилище изображений.
 *  local — файлы в UPLOAD_DIR, отдаются через /media/... (подходит для VPS)
 *  s3    — любое S3-совместимое облако (AWS S3, Yandex Object Storage, Cloudflare R2, PS Cloud и др.)
 * Все изображения конвертируются в WebP и ограничиваются 2000px по большей стороне.
 */
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 15 * 1024 * 1024;

let s3: S3Client | null = null;
function getS3() {
  s3 ??= new S3Client({
    region: env.storage.s3Region,
    endpoint: env.storage.s3Endpoint || undefined,
    forcePathStyle: !!env.storage.s3Endpoint,
    credentials: { accessKeyId: env.storage.s3AccessKey, secretAccessKey: env.storage.s3SecretKey },
  });
  return s3;
}

export async function saveImage(file: File, folder: "products" | "banners" | "categories" | "looks" | "misc"): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error(`Недопустимый формат файла: ${file.type || "unknown"}. Разрешены JPEG, PNG, WebP, AVIF.`);
  if (file.size > MAX_BYTES) throw new Error("Файл больше 15 МБ");
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  const now = new Date();
  const key = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomBytes(10).toString("hex")}.webp`;

  if (env.storage.driver === "s3") {
    if (!env.storage.s3Bucket || !env.storage.s3PublicUrl) throw new Error("S3 не настроен: задайте S3_BUCKET и S3_PUBLIC_URL");
    await getS3().send(
      new PutObjectCommand({
        Bucket: env.storage.s3Bucket,
        Key: key,
        Body: output,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return `${env.storage.s3PublicUrl}/${key}`;
  }

  const target = path.resolve(env.storage.localDir, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, output);
  return `/media/${key}`;
}
