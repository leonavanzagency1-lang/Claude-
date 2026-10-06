import { quoteDto } from "@/lib/dto";
import { createClaudeCaller } from "@/lib/ai/claude";
import { createMockCaller } from "@/lib/ai/mock";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { handle, parseId } from "@/lib/http/route";
import { photoForAi } from "@/lib/media";
import { interpretQuote } from "@/lib/services/quotes";
import { readUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 300;

export async function POST(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const caller = config.mockAi ? createMockCaller() : createClaudeCaller();
    return quoteDto(await interpretQuote(prisma, id, caller, async (path) => photoForAi(await readUpload(path))));
  });
}
