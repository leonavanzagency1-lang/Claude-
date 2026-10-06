import { quoteDto } from "@/lib/dto";
import { prisma } from "@/lib/db";
import { handle, parseId, readJson } from "@/lib/http/route";
import { getQuote, updateQuote, type QuotePatch } from "@/lib/services/quotes";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => quoteDto(await getQuote(prisma, parseId((await params).id))));
}

export async function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    await updateQuote(prisma, id, (await readJson(request)) as QuotePatch);
    return quoteDto(await getQuote(prisma, id));
  });
}
