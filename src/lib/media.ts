import "server-only";
import sharp from "sharp";
import { AppError } from "@/lib/errors";

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

const AUDIO_EXTS = new Set(["webm", "m4a", "mp4", "mp3", "mpeg", "mpga", "wav", "ogg", "flac"]);

/** Kontrollerar en ljudfil och returnerar filändelse som tjänsten känner igen. */
export function validateAudio(file: { name: string; type: string; size: number }): string {
  if (file.size === 0) throw new AppError("Ljudfilen är tom.", 400);
  if (file.size > MAX_AUDIO_BYTES) {
    throw new AppError("Ljudfilen är för stor (max 25 MB). Spela in kortare avsnitt.", 400);
  }
  const baseType = file.type.split(";")[0].trim().toLowerCase();
  const byType = AUDIO_TYPES[baseType];
  if (byType) return byType;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXTS.has(ext)) return ext;
  throw new AppError(
    "Filformatet stöds inte. Använd en ljudfil i formatet webm, m4a, mp4, mp3, wav, ogg eller flac.",
    400,
  );
}

export function audioMimeForExt(ext: string): string {
  const map: Record<string, string> = {
    webm: "audio/webm",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    mp3: "audio/mpeg",
    mpeg: "audio/mpeg",
    mpga: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return map[ext] ?? "application/octet-stream";
}

async function runSharp<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new AppError(
      "Filen kunde inte läsas som en bild. Använd JPEG, PNG eller WebP.",
      400,
      { cause: error },
    );
  }
}

/** Normaliserar ett foto: roterar enligt EXIF, skalar ned, tar bort metadata (t.ex. GPS) och sparar som JPEG. */
export async function normalizePhoto(data: Uint8Array): Promise<Buffer> {
  if (data.byteLength > MAX_PHOTO_BYTES) throw new AppError("Bilden är för stor (max 20 MB).", 400);
  return runSharp(() =>
    sharp(data)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer(),
  );
}

/** Normaliserar en logotyp till PNG (behåller transparens). */
export async function normalizeLogo(data: Uint8Array): Promise<Buffer> {
  if (data.byteLength > 5 * 1024 * 1024) throw new AppError("Logotypen är för stor (max 5 MB).", 400);
  return runSharp(() =>
    sharp(data).rotate().resize({ width: 800, height: 400, fit: "inside", withoutEnlargement: true }).png().toBuffer(),
  );
}

/** Förminskar en bild inför AI-tolkning. */
export async function photoForAi(data: Uint8Array): Promise<string> {
  const buffer = await runSharp(() =>
    sharp(data)
      .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer(),
  );
  return buffer.toString("base64");
}
