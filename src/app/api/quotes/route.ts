import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/http/route";
import { createQuote, type NewQuoteInput } from "@/lib/services/quotes";

export async function POST(request: Request) {
  return handle(async () => createQuote(prisma, (await readJson(request)) as NewQuoteInput));
}
