import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Company } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { readUpload } from "@/lib/storage";
import type { QuoteWithRelations } from "@/lib/services/quotes";
import { buildPdfModel } from "./model";
import { pdfSafeDeep } from "./text";
import { QuoteDocument } from "./QuoteDocument";

async function tryRead(path: string | null): Promise<Buffer | null> {
  if (!path) return null;
  try {
    return await readUpload(path);
  } catch {
    return null; // saknad bild ska inte stoppa PDF:en
  }
}

export async function renderQuotePdf(quote: QuoteWithRelations, company: Company): Promise<Buffer> {
  const model = pdfSafeDeep(buildPdfModel(quote, company, new Date()));
  const [logo, visualization] = await Promise.all([tryRead(company.logoPath), tryRead(quote.visualizationPath)]);
  try {
    // QuoteDocument anropas direkt så att roten är ett <Document>-element.
    return await renderToBuffer(QuoteDocument({ model, images: { logo, visualization } }));
  } catch (error) {
    throw new AppError("PDF:en kunde inte skapas.", 500, { cause: error });
  }
}
