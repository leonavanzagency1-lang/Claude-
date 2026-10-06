import { quoteDto } from "@/lib/dto";
import { loadQuoteForPage } from "@/lib/load";
import { QuoteSteps } from "@/components/QuoteSteps";
import { MaterialEditor } from "./MaterialEditor";

export const dynamic = "force-dynamic";

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const quote = await loadQuoteForPage((await params).id);
  return (
    <div>
      <QuoteSteps id={quote.id} current="underlag" number={quote.number} customer={quote.customerName} />
      <MaterialEditor initial={quoteDto(quote)} />
    </div>
  );
}
