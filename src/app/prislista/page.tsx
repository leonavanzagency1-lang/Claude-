import { prisma } from "@/lib/db";
import { articleDto } from "@/lib/dto";
import { PriceListEditor } from "./PriceListEditor";

export const dynamic = "force-dynamic";

export default async function PriceListPage() {
  const articles = await prisma.article.findMany({ orderBy: { number: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Prislista</h1>
      <p className="text-sm text-stone-600">
        Alla priser i offerterna hämtas härifrån (eller anges av dig). AI:n sätter aldrig priser. Priser anges exkl. moms.
      </p>
      <PriceListEditor initial={articles.map(articleDto)} />
    </div>
  );
}
