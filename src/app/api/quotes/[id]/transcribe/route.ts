import { quoteDto } from "@/lib/dto";
import { prisma } from "@/lib/db";
import { handle, parseId } from "@/lib/http/route";
import { transcribeQuote } from "@/lib/services/quotes";
import { readUpload } from "@/lib/storage";
import { getTranscriber } from "@/lib/transcription";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 300;

export async function POST(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    return quoteDto(await transcribeQuote(prisma, id, getTranscriber(), async (path) => new Uint8Array(await readUpload(path))));
  });
}
