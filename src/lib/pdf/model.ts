import type { Company } from "@prisma/client";
import { ROT_DISCLAIMER, type QuoteTotals } from "@/lib/calc/quote";
import { formatBp, formatMilli, formatOre } from "@/lib/calc/money";
import { addDays, formatDate } from "@/lib/dates";
import { listsFor, totalsFor, type QuoteWithRelations } from "@/lib/services/quotes";

export interface PdfRow {
  description: string;
  articleNumber: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
}

export interface PdfSummaryRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface PdfModel {
  number: string;
  date: string;
  validUntil: string;
  validityDays: number;
  company: {
    name: string;
    orgNumber: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    fSkatt: boolean;
    paymentTerms: string;
    logoPath: string | null;
  };
  customer: { name: string; address: string; phone: string; email: string; propertyDesignation: string };
  summary: string;
  introText: string;
  rows: PdfRow[];
  totals: QuoteTotals;
  summaryRows: PdfSummaryRow[];
  rotNote: string | null;
  assumptions: string[];
  exclusions: string[];
  termsText: string;
  closingText: string;
  visualizationPath: string | null;
}

/**
 * Bygger allt innehåll i PDF:en. Summorna kommer från samma beräkning som
 * visas på skärmen (totalsFor), så de stämmer alltid överens.
 */
export function buildPdfModel(quote: QuoteWithRelations, company: Company, today: Date): PdfModel {
  const totals = totalsFor(quote, company);
  const lists = listsFor(quote);

  const rows: PdfRow[] = quote.lines.map((line, i) => ({
    description: line.description,
    articleNumber: line.articleNumber ?? "",
    quantity: formatMilli(line.quantityMilli),
    unit: line.unit,
    unitPrice: line.unitPriceOre === null ? "–" : formatOre(line.unitPriceOre, false),
    amount: formatOre(totals.lines[i].netOre, false),
  }));

  const summaryRows: PdfSummaryRow[] = [
    { label: "Summa arbete", value: formatOre(totals.laborOre) },
    { label: "Summa material", value: formatOre(totals.materialOre) },
  ];
  if (totals.otherOre !== 0) summaryRows.push({ label: "Summa övrigt", value: formatOre(totals.otherOre) });
  if (totals.markupOre !== 0) summaryRows.push({ label: "Påslag", value: formatOre(totals.markupOre) });
  summaryRows.push(
    { label: "Summa exkl. moms", value: formatOre(totals.totalExVatOre) },
    { label: `Moms ${formatBp(company.vatBp)} %`, value: formatOre(totals.vatOre) },
    { label: "Summa inkl. moms", value: formatOre(totals.totalInclVatOre), strong: !totals.rot },
  );
  if (totals.rot) {
    summaryRows.push(
      { label: "Preliminärt ROT-avdrag", value: `−${formatOre(totals.rot.deductionOre)}` },
      { label: "Att betala efter ROT-avdrag", value: formatOre(totals.toPayOre), strong: true },
    );
  }

  return {
    number: quote.number,
    date: formatDate(today),
    validUntil: formatDate(addDays(today, company.validityDays)),
    validityDays: company.validityDays,
    company: {
      name: company.name,
      orgNumber: company.orgNumber,
      address: company.address,
      phone: company.phone,
      email: company.email,
      website: company.website,
      fSkatt: company.fSkatt,
      paymentTerms: company.paymentTerms,
      logoPath: company.logoPath,
    },
    customer: {
      name: quote.customerName,
      address: quote.customerAddress,
      phone: quote.customerPhone,
      email: quote.customerEmail,
      propertyDesignation: quote.propertyDesignation,
    },
    summary: quote.summary,
    introText: quote.introText,
    rows,
    totals,
    summaryRows,
    rotNote: totals.rot
      ? `${ROT_DISCLAIMER}. Avdraget är beräknat på arbetskostnaden ${formatOre(totals.rot.laborInclVatOre)} inkl. moms${
          totals.rot.capped ? `, begränsat till maxbeloppet ${formatOre(totals.rot.capOre)}` : ""
        }.`
      : null,
    assumptions: lists.assumptions,
    exclusions: lists.exclusions,
    termsText: quote.termsText,
    closingText: quote.closingText,
    visualizationPath: quote.visualizationPath,
  };
}
