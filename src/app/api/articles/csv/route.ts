import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { articlesToCsv, parseArticlesCsv, type CsvArticle } from "@/lib/csv/articles";
import { LineTypeSchema, UnitSchema } from "@/lib/domain";
import { filesFrom, handle, readForm } from "@/lib/http/route";

export async function GET() {
  return handle(async () => {
    const articles = await prisma.article.findMany({ orderBy: { number: "asc" } });
    const rows: CsvArticle[] = articles.map((a) => ({
      number: a.number,
      name: a.name,
      type: LineTypeSchema.catch("övrigt").parse(a.type),
      unit: UnitSchema.catch("st").parse(a.unit),
      unitPriceOre: a.unitPriceOre,
      markupBp: a.markupBp,
      isExamplePrice: a.isExamplePrice,
    }));
    return new Response(articlesToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="prislista.csv"',
      },
    });
  });
}

/** Importerar artiklar. Befintliga artikelnummer uppdateras, nya skapas. Vid fel importeras ingenting. */
export async function POST(request: Request) {
  return handle(async () => {
    const [file] = filesFrom(await readForm(request), "file");
    if (!file) throw new AppError("Ingen fil valdes.", 400);
    if (file.size > 2 * 1024 * 1024) throw new AppError("CSV-filen är för stor (max 2 MB).", 400);
    const { articles, errors } = parseArticlesCsv(await file.text());
    if (errors.length > 0) {
      return Response.json({ error: "CSV-filen innehåller fel. Inget har importerats.", details: errors }, { status: 400 });
    }
    const existing = new Set((await prisma.article.findMany({ select: { number: true } })).map((a) => a.number));
    await prisma.$transaction(
      articles.map((a) =>
        prisma.article.upsert({ where: { number: a.number }, update: a, create: a }),
      ),
    );
    const updated = articles.filter((a) => existing.has(a.number)).length;
    return { created: articles.length - updated, updated };
  });
}
