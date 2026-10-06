import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { handle, readJson } from "@/lib/http/route";
import { parseOrThrow } from "@/lib/services/quotes";
import { ArticleInputSchema } from "@/lib/services/settings";

export async function GET() {
  return handle(() => prisma.article.findMany({ orderBy: { number: "asc" } }));
}

export async function POST(request: Request) {
  return handle(async () => {
    const data = parseOrThrow(ArticleInputSchema, await readJson(request));
    try {
      return await prisma.article.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(`Artikelnummer ${data.number} finns redan.`, 409);
      }
      throw error;
    }
  });
}
