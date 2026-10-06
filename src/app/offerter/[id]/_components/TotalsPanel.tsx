import { formatBp, formatOre } from "@/lib/calc/money";
import { ROT_DISCLAIMER, type QuoteTotals } from "@/lib/calc/quote";
import { cx } from "@/components/ui";

export function TotalsPanel({ totals, vatBp }: { totals: QuoteTotals; vatBp: number }) {
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Summa arbete", value: formatOre(totals.laborOre) },
    { label: "Summa material", value: formatOre(totals.materialOre) },
    { label: "Summa övrigt", value: formatOre(totals.otherOre) },
    { label: "Påslag", value: formatOre(totals.markupOre) },
    { label: "Summa exkl. moms", value: formatOre(totals.totalExVatOre) },
    { label: `Moms ${formatBp(vatBp)} %`, value: formatOre(totals.vatOre) },
    { label: "Summa inkl. moms", value: formatOre(totals.totalInclVatOre), strong: !totals.rot },
  ];
  if (totals.rot) {
    rows.push(
      { label: "Preliminärt ROT-avdrag", value: `−${formatOre(totals.rot.deductionOre)}` },
      { label: "Att betala efter avdrag", value: formatOre(totals.toPayOre), strong: true },
    );
  }
  return (
    <div data-testid="totals">
      <dl className="divide-y divide-stone-100 text-sm">
        {rows.map((r) => (
          <div key={r.label} className={cx("flex justify-between py-1.5", r.strong && "text-base font-semibold")}>
            <dt>{r.label}</dt>
            <dd className="tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      {totals.rot && (
        <p className="mt-2 text-xs text-stone-600">
          {ROT_DISCLAIMER}. Beräknat på arbetskostnad {formatOre(totals.rot.laborInclVatOre)} inkl. moms
          {totals.rot.capped ? `, begränsat till maxbeloppet ${formatOre(totals.rot.capOre)}` : ""}.
        </p>
      )}
    </div>
  );
}
