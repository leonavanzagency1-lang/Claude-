import { quoteDto } from "@/lib/dto";
import { prisma } from "@/lib/db";
import { handle, parseId, readJson } from "@/lib/http/route";
import { getQuote, setStatus } from "@/lib/services/quotes";

type Ctx = { params: Promise<{ id: string }> };

/** Statusen ändras enbart manuellt. Systemet skickar aldrig något till kunden. */
export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const body = (await readJson(request)) as { status?: unknown };
    await setStatus(prisma, id, body?.status);
    return quoteDto(await getQuote(prisma, id));
  });
}
