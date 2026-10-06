import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { handle, parseId, readJson } from "@/lib/http/route";
import { parseOrThrow } from "@/lib/services/quotes";
import { ArticleInputSchema } from "@/lib/services/settings";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const data = parseOrThrow(ArticleInputSchema, await readJson(request));
    try {
      return await prisma.article.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw new AppError(`Artikelnummer ${data.number} finns redan.`, 409);
        if (error.code === "P2025") throw new AppError("Artikeln hittades inte.", 404);
      }
      throw error;
    }
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const deleted = await prisma.article.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new AppError("Artikeln hittades inte.", 404);
    return { ok: true };
  });
}
