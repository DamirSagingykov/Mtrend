import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/** Раздача загруженных изображений при STORAGE_DRIVER=local */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  if (parts.some((p) => p === ".." || p.includes("\0"))) return new Response("Not found", { status: 404 });
  const root = path.resolve(env.storage.localDir);
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error("not a file");
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".webp" ? "image/webp" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".avif" ? "image/avif" : "application/octet-stream";
    return new Response(new Uint8Array(await readFile(file)), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
