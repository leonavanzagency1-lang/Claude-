import { prisma } from "@/lib/db";
import { articleDto, quoteDto } from "@/lib/dto";
import { loadQuoteForPage } from "@/lib/load";
import { getCompany } from "@/lib/services/company";
import { QuoteSteps } from "@/components/QuoteSteps";
import { ReviewEditor } from "./ReviewEditor";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const quote = await loadQuoteForPage((await params).id);
  const [company, articles] = await Promise.all([getCompany(prisma), prisma.article.findMany({ orderBy: { number: "asc" } })]);
  return (
    <div>
      <QuoteSteps id={quote.id} current="granskning" number={quote.number} customer={quote.customerName} />
      <ReviewEditor
        initial={quoteDto(quote)}
        articles={articles.map(articleDto)}
        company={{
          vatBp: company.vatBp,
          hourlyRateOre: company.hourlyRateOre,
          rotPercentBp: company.rotPercentBp,
          rotMaxPerPersonOre: company.rotMaxPerPersonOre,
        }}
      />
    </div>
  );
}
