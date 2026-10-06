import { quoteDto } from "@/lib/dto";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { filesFrom, handle, parseId, readForm } from "@/lib/http/route";
import { normalizePhoto } from "@/lib/media";
import { getQuote } from "@/lib/services/quotes";
import { deleteUpload, saveUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const [file] = filesFrom(await readForm(request), "file");
    if (!file) throw new AppError("Ingen fil valdes.", 400);
    const quote = await getQuote(prisma, id);
    const jpeg = await normalizePhoto(new Uint8Array(await file.arrayBuffer()));
    const path = await saveUpload(jpeg, `quotes/${id}`, "jpg");
    await prisma.quote.update({ where: { id }, data: { visualizationPath: path } });
    await deleteUpload(quote.visualizationPath);
    return quoteDto(await getQuote(prisma, id));
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const quote = await getQuote(prisma, id);
    await prisma.quote.update({ where: { id }, data: { visualizationPath: null } });
    await deleteUpload(quote.visualizationPath);
    return quoteDto(await getQuote(prisma, id));
  });
}
