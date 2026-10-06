import { quoteDto } from "@/lib/dto";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { handle, parseId } from "@/lib/http/route";
import { getQuote } from "@/lib/services/quotes";
import { deleteUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const p = await params;
    const id = parseId(p.id);
    const attachmentId = parseId(p.attachmentId);
    const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, quoteId: id } });
    if (!attachment) throw new AppError("Filen hittades inte.", 404);
    await prisma.attachment.delete({ where: { id: attachmentId } });
    await deleteUpload(attachment.path);
    return quoteDto(await getQuote(prisma, id));
  });
}
