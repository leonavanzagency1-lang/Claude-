import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatOre } from "@/lib/calc/money";
import { formatDate } from "@/lib/dates";
import { QuoteStatusSchema, STATUS_LABELS } from "@/lib/domain";
import { getCompany } from "@/lib/services/company";
import { totalsFor } from "@/lib/services/quotes";
import { StatusSelect } from "@/components/StatusSelect";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

function nextStepHref(q: { id: number; lines: unknown[]; transcript: string; notes: string }) {
  if (q.lines.length > 0) return `/offerter/${q.id}`;
  return `/offerter/${q.id}/underlag`;
}

export default async function OverviewPage() {
  const [quotes, company] = await Promise.all([
    prisma.quote.findMany({ include: { lines: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "desc" } }),
    getCompany(prisma),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Offerter</h1>
        <Link href="/offerter/ny" className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700">
          + Nytt platsbesök
        </Link>
      </div>
      <p className="text-sm text-stone-600">
        Statusen ändras manuellt. Systemet skickar aldrig något till kunden – du laddar ned PDF:en och skickar den själv.
      </p>

      {quotes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center text-stone-600">
          Inga offerter ännu. Börja med ett nytt platsbesök.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="hidden bg-stone-50 text-left text-stone-600 md:table-header-group">
              <tr>
                <th className="px-4 py-2 font-medium">Nr</th>
                <th className="px-4 py-2 font-medium">Kund</th>
                <th className="px-4 py-2 text-right font-medium">Belopp inkl. moms</th>
                <th className="px-4 py-2 font-medium">Datum</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {quotes.map((q) => {
                const totals = totalsFor(q, company);
                const status = QuoteStatusSchema.catch("utkast").parse(q.status);
                return (
                  <tr key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 md:table-row md:px-0 md:py-0">
                    <td className="md:px-4 md:py-3">
                      <Link href={nextStepHref(q)} className="font-mono text-amber-700 underline-offset-2 hover:underline">
                        {q.number}
                      </Link>
                    </td>
                    <td className="min-w-0 flex-1 md:px-4 md:py-3">
                      <Link href={nextStepHref(q)} className="font-medium hover:underline">
                        {q.customerName}
                      </Link>
                      <span className="ml-2 md:hidden">
                        <StatusBadge status={status} label={STATUS_LABELS[status]} />
                      </span>
                    </td>
                    <td className="w-full text-right font-medium tabular-nums md:w-auto md:px-4 md:py-3">
                      {q.lines.length > 0 ? formatOre(totals.totalInclVatOre) : "–"}
                    </td>
                    <td className="text-stone-600 md:px-4 md:py-3">{formatDate(q.createdAt)}</td>
                    <td className="md:px-4 md:py-3">
                      <StatusSelect quoteId={q.id} status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
