import { z } from "zod";

// Svenska felmeddelanden från Zod.
z.config(z.locales.sv());

export const LINE_TYPES = ["arbete", "material", "övrigt"] as const;
export const UNITS = ["st", "m", "m²", "m³", "tim", "paket"] as const;
export const CONFIDENCES = ["hög", "medel", "låg"] as const;
export const QUOTE_STATUSES = ["utkast", "granskad", "skickad", "accepterad", "avböjd"] as const;
export const PRICE_SOURCES = ["prislista", "timpris", "manuell"] as const;

export const LineTypeSchema = z.enum(LINE_TYPES);
export const UnitSchema = z.enum(UNITS);
export const ConfidenceSchema = z.enum(CONFIDENCES);
export const QuoteStatusSchema = z.enum(QUOTE_STATUSES);
export const PriceSourceSchema = z.enum(PRICE_SOURCES);

export type LineType = z.infer<typeof LineTypeSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;
export type PriceSource = z.infer<typeof PriceSourceSchema>;

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  utkast: "Utkast",
  granskad: "Granskad",
  skickad: "Skickad",
  accepterad: "Accepterad",
  avböjd: "Avböjd",
};

export const TYPE_LABELS: Record<LineType, string> = {
  arbete: "Arbete",
  material: "Material",
  övrigt: "Övrigt",
};

/** En offertrad som den används i beräkning, granskning och PDF. */
export const QuoteLineInputSchema = z.object({
  articleId: z.number().int().positive().nullable(),
  articleNumber: z.string().nullable(),
  description: z.string().max(500),
  quantityMilli: z.number().int().min(0).max(1_000_000_000),
  unit: UnitSchema,
  type: LineTypeSchema,
  unitPriceOre: z.number().int().min(0).max(10_000_000_000).nullable(),
  markupBp: z.number().int().min(0).max(100_000),
  priceSource: PriceSourceSchema.nullable(),
  source: z.string().max(1000),
  confidence: ConfidenceSchema,
  confirmed: z.boolean(),
  origin: z.enum(["ai", "manuell"]),
});
export type QuoteLineInput = z.infer<typeof QuoteLineInputSchema>;

export const StringListSchema = z.array(z.string());

/** Läser en JSON-lista ur databasen. Ogiltig data ger en tom lista i stället för krasch. */
export function parseStringList(raw: string): string[] {
  try {
    const parsed = StringListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
