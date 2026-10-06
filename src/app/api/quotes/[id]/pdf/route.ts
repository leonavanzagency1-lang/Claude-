import { prisma } from "@/lib/db";
import { handle, parseId } from "@/lib/http/route";
import { renderQuotePdf } from "@/lib/pdf/render";
import { getCompany } from "@/lib/services/company";
import { getQuote } from "@/lib/services/quotes";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const id = parseId((await params).id);
    const [quote, company] = await Promise.all([getQuote(prisma, id), getCompany(prisma)]);
    const pdf = await renderQuotePdf(quote, company);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="offert-${quote.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
