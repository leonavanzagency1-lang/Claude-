import { z } from "zod";

const ore = z.number().int().min(0).max(100_000_000_00);

export const CompanySettingsSchema = z.object({
  name: z.string().trim().max(200),
  orgNumber: z.string().trim().max(20),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(50),
  email: z.string().trim().max(200),
  website: z.string().trim().max(200),
  fSkatt: z.boolean(),
  paymentTerms: z.string().trim().max(500),
  validityDays: z.number().int().min(1).max(365),
  introText: z.string().max(5000),
  termsText: z.string().max(10_000),
  closingText: z.string().max(5000),
  hourlyRateOre: ore.nullable(),
  vatBp: z.number().int().min(0).max(10_000),
  rotPercentBp: z.number().int().min(0).max(10_000).nullable(),
  rotMaxPerPersonOre: ore.nullable(),
});
export type CompanySettings = z.infer<typeof CompanySettingsSchema>;

export const ArticleInputSchema = z.object({
  number: z.string().trim().min(1, "Artikelnummer måste fyllas i").max(50),
  name: z.string().trim().min(1, "Namn måste fyllas i").max(200),
  type: z.enum(["arbete", "material", "övrigt"]),
  unit: z.enum(["st", "m", "m²", "m³", "tim", "paket"]),
  unitPriceOre: ore,
  markupBp: z.number().int().min(0).max(100_000),
  isExamplePrice: z.boolean().default(false),
});
export type ArticleInput = z.input<typeof ArticleInputSchema>;
