import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";

/** Sparar en fil i uppladdningsmappen och returnerar en relativ sökväg. */
export async function saveUpload(data: Uint8Array, folder: string, ext: string): Promise<string> {
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
  const relative = path.posix.join(safeFolder, `${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "")}`);
  const absolute = resolveUploadPath(relative);
  try {
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, data);
  } catch (error) {
    throw new AppError("Kunde inte spara filen på disken.", 500, { cause: error });
  }
  return relative;
}

/** Löser en relativ sökväg mot uppladdningsmappen och stoppar försök att ta sig ut ur den. */
export function resolveUploadPath(relative: string): string {
  const root = config.uploadDir;
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new AppError("Ogiltig filsökväg.", 400);
  }
  return absolute;
}

export async function readUpload(relative: string): Promise<Buffer> {
  try {
    return await readFile(resolveUploadPath(relative));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Filen hittades inte.", 404, { cause: error });
  }
}

export async function deleteUpload(relative: string | null | undefined): Promise<void> {
  if (!relative) return;
  try {
    await unlink(resolveUploadPath(relative));
  } catch {
    // Filen kan redan vara borttagen – inget att göra.
  }
}
