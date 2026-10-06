import { quoteDto } from "@/lib/dto";
import { loadQuoteForPage } from "@/lib/load";
import { QuoteSteps } from "@/components/QuoteSteps";
import { TranscriptEditor } from "./TranscriptEditor";

export const dynamic = "force-dynamic";

export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const quote = await loadQuoteForPage((await params).id);
  return (
    <div>
      <QuoteSteps id={quote.id} current="transkribering" number={quote.number} customer={quote.customerName} />
      <TranscriptEditor initial={quoteDto(quote)} />
    </div>
  );
}
