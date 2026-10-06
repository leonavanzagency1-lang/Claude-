import { quoteDto } from "@/lib/dto";
import { prisma } from "@/lib/db";
import { handle, parseId, readJson } from "@/lib/http/route";
import { saveLines } from "@/lib/services/quotes";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const body = (await readJson(request)) as { lines?: unknown };
    return quoteDto(await saveLines(prisma, id, body?.lines));
  });
}
