import type { Article, Attachment, Company, Quote, QuoteLine } from "@prisma/client";
import { parseStringList } from "@/lib/domain";
import { lineFromDb } from "@/lib/services/quotes";

/** Data som skickas till klientkomponenter (inga Date-objekt, listor tolkade). */
export function quoteDto(quote: Quote & { lines: QuoteLine[]; attachments: Attachment[] }) {
  return {
    id: quote.id,
    number: quote.number,
    status: quote.status,
    customerName: quote.customerName,
    customerAddress: quote.customerAddress,
    customerPhone: quote.customerPhone,
    customerEmail: quote.customerEmail,
    propertyDesignation: quote.propertyDesignation,
    notes: quote.notes,
    transcript: quote.transcript,
    summary: quote.summary,
    assumptions: parseStringList(quote.assumptions),
    uncertainties: parseStringList(quote.uncertainties),
    customerQuestions: parseStringList(quote.customerQuestions),
    exclusions: parseStringList(quote.exclusions),
    introText: quote.introText,
    termsText: quote.termsText,
    closingText: quote.closingText,
    rotEnabled: quote.rotEnabled,
    rotPersons: quote.rotPersons,
    visualizationPath: quote.visualizationPath,
    interpretedAt: quote.interpretedAt?.toISOString() ?? null,
    createdAt: quote.createdAt.toISOString(),
    lines: quote.lines.map(lineFromDb),
    attachments: quote.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      path: a.path,
      originalName: a.originalName,
      size: a.size,
      transcribed: a.transcript !== null,
    })),
  };
}
export type QuoteDto = ReturnType<typeof quoteDto>;

export function articleDto(a: Article) {
  return {
    id: a.id,
    number: a.number,
    name: a.name,
    type: a.type,
    unit: a.unit,
    unitPriceOre: a.unitPriceOre,
    markupBp: a.markupBp,
    isExamplePrice: a.isExamplePrice,
  };
}
export type ArticleDto = ReturnType<typeof articleDto>;

export function companyDto(c: Company) {
  return {
    name: c.name,
    orgNumber: c.orgNumber,
    address: c.address,
    phone: c.phone,
    email: c.email,
    website: c.website,
    logoPath: c.logoPath,
    fSkatt: c.fSkatt,
    paymentTerms: c.paymentTerms,
    validityDays: c.validityDays,
    introText: c.introText,
    termsText: c.termsText,
    closingText: c.closingText,
    hourlyRateOre: c.hourlyRateOre,
    vatBp: c.vatBp,
    rotPercentBp: c.rotPercentBp,
    rotMaxPerPersonOre: c.rotMaxPerPersonOre,
  };
}
export type CompanyDto = ReturnType<typeof companyDto>;

/** Klienten tar emot API-svar för offerter i samma form som quoteDto. */
export function isQuoteDto(value: unknown): value is QuoteDto {
  return typeof value === "object" && value !== null && "lines" in value && "attachments" in value;
}
