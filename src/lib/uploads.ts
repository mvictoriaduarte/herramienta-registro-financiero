import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "sources");

export async function saveSourceLogo(
  file: File | null | undefined,
  sourceId: string,
): Promise<{ url: string } | { error: string } | null> {
  if (!file || file.size === 0) {
    return null;
  }

  if (file.size > MAX_LOGO_BYTES) {
    return { error: "El logo no puede superar 2 MB." };
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return { error: "Usá una imagen JPG, PNG, WEBP o GIF." };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${sourceId}-${Date.now()}${extension}`;
  const absolute = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolute, buffer);

  return { url: `/uploads/sources/${filename}` };
}

export async function deleteSourceLogoFile(logoUrl: string | null | undefined) {
  if (!logoUrl || !logoUrl.startsWith("/uploads/sources/")) {
    return;
  }

  const absolute = path.join(process.cwd(), "public", logoUrl.replace(/^\//, ""));
  try {
    await unlink(absolute);
  } catch {
    // Ignore missing files.
  }
}
