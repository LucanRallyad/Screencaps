import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import imageSize from "image-size";
import { db } from "@/lib/db/client";
import { ads } from "@/lib/db/schema";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function saveAdFile(projectId: string, file: File) {
  if (!ALLOWED.has(file.type)) throw new Error(`Unsupported file type: ${file.type}`);
  if (file.size > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");

  const dir = path.join(UPLOAD_DIR, "ads", projectId);
  await fs.mkdir(dir, { recursive: true });

  const ext =
    file.type === "image/png" ? "png" :
    file.type === "image/jpeg" ? "jpg" :
    file.type === "image/gif" ? "gif" : "webp";

  const id = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const storagePath = path.join(dir, `${id}-${safeName}`);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storagePath, buf);

  const { width, height } = imageSize(buf);
  if (!width || !height) throw new Error("Could not read image dimensions");

  await db.insert(ads).values({
    id,
    projectId,
    filename: file.name,
    storagePath,
    mimeType: file.type,
    width,
    height,
    sizeBytes: file.size,
  });

  return { id, filename: file.name, width, height };
}
