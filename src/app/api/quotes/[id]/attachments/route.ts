import { quoteDto } from "@/lib/dto";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { filesFrom, handle, parseId, readForm } from "@/lib/http/route";
import { audioMimeForExt, normalizePhoto, validateAudio } from "@/lib/media";
import { addAttachment, getQuote } from "@/lib/services/quotes";
import { saveUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const MAX_FILES = 20;

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const form = await readForm(request);
    const kind = form.get("kind");
    if (kind !== "audio" && kind !== "photo") throw new AppError("Okänd typ av underlag.", 400);
    const files = filesFrom(form, "files");
    if (files.length === 0) throw new AppError("Ingen fil valdes.", 400);
    if (files.length > MAX_FILES) throw new AppError(`Högst ${MAX_FILES} filer åt gången.`, 400);
    await getQuote(prisma, id);

    // Validera alla filer innan något sparas.
    const prepared = await Promise.all(
      files.map(async (file) => {
        const data = new Uint8Array(await file.arrayBuffer());
        if (kind === "audio") {
          const ext = validateAudio({ name: file.name, type: file.type, size: data.byteLength });
          return { file, data, ext, mimeType: audioMimeForExt(ext) };
        }
        const jpeg = await normalizePhoto(data);
        return { file, data: new Uint8Array(jpeg), ext: "jpg", mimeType: "image/jpeg" };
      }),
    );

    for (const p of prepared) {
      const path = await saveUpload(p.data, `quotes/${id}`, p.ext);
      await addAttachment(prisma, id, {
        kind,
        path,
        mimeType: p.mimeType,
        originalName: p.file.name || (kind === "audio" ? "inspelning" : "foto"),
        size: p.data.byteLength,
      });
    }
    return quoteDto(await getQuote(prisma, id));
  });
}
