import type { Attachment, Company, PrismaClient, Quote, QuoteLine } from "@prisma/client";
import { z } from "zod";
import { calcQuote, type QuoteTotals } from "@/lib/calc/quote";
import {
  ConfidenceSchema,
  LineTypeSchema,
  PriceSourceSchema,
  QuoteLineInputSchema,
  QuoteStatusSchema,
  UnitSchema,
  parseStringList,
  type QuoteLineInput,
  type QuoteStatus,
} from "@/lib/domain";
import { AppError } from "@/lib/errors";
import { checkReadiness } from "@/lib/quote/readiness";
import { interpretWithRetry, type CallModel } from "@/lib/ai/interpret";
import { buildUserText } from "@/lib/ai/prompt";
import { mapAiLines } from "@/lib/ai/mapping";
import type { Transcriber } from "@/lib/transcription/types";
import { getCompany } from "./company";

export type QuoteWithRelations = Quote & { lines: QuoteLine[]; attachments: Attachment[] };

export const NewQuoteSchema = z.object({
  customerName: z.string().trim().min(1, "Kundens namn måste fyllas i").max(200),
  customerAddress: z.string().trim().max(500).default(""),
  customerPhone: z.string().trim().max(50).default(""),
  customerEmail: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Ogiltig e-postadress")
    .default(""),
  propertyDesignation: z.string().trim().max(200).default(""),
});
export type NewQuoteInput = z.input<typeof NewQuoteSchema>;

const StringList = z.array(z.string().trim().max(1000)).max(100);

export const QuotePatchSchema = NewQuoteSchema.partial().extend({
  notes: z.string().max(20_000).optional(),
  transcript: z.string().max(100_000).optional(),
  summary: z.string().max(5000).optional(),
  assumptions: StringList.optional(),
  uncertainties: StringList.optional(),
  customerQuestions: StringList.optional(),
  exclusions: StringList.optional(),
  introText: z.string().max(5000).optional(),
  termsText: z.string().max(10_000).optional(),
  closingText: z.string().max(5000).optional(),
  rotEnabled: z.boolean().optional(),
  rotPersons: z.number().int().min(1).max(10).optional(),
});
export type QuotePatch = z.input<typeof QuotePatchSchema>;

async function nextQuoteNumber(db: Pick<PrismaClient, "quoteCounter">, now: Date): Promise<string> {
  const year = now.getFullYear();
  const counter = await db.quoteCounter.upsert({
    where: { year },
    create: { year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return `${year}-${counter.last.toString().padStart(4, "0")}`;
}

export async function createQuote(db: PrismaClient, input: NewQuoteInput, now = new Date()): Promise<Quote> {
  const data = parseOrThrow(NewQuoteSchema, input);
  const company = await getCompany(db);
  return db.$transaction(async (tx) => {
    const number = await nextQuoteNumber(tx, now);
    return tx.quote.create({
      data: {
        ...data,
        number,
        introText: company.introText,
        termsText: company.termsText,
        closingText: company.closingText,
        rotEnabled: company.rotPercentBp !== null && company.rotMaxPerPersonOre !== null,
      },
    });
  });
}

export async function getQuote(db: PrismaClient, id: number): Promise<QuoteWithRelations> {
  const quote = await db.quote.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } }, attachments: { orderBy: { createdAt: "asc" } } },
  });
  if (!quote) throw new AppError("Offerten hittades inte.", 404);
  return quote;
}

export function lineFromDb(line: QuoteLine): QuoteLineInput {
  return {
    articleId: line.articleId,
    articleNumber: line.articleNumber,
    description: line.description,
    quantityMilli: line.quantityMilli,
    unit: UnitSchema.catch("st").parse(line.unit),
    type: LineTypeSchema.catch("övrigt").parse(line.type),
    unitPriceOre: line.unitPriceOre,
    markupBp: line.markupBp,
    priceSource: PriceSourceSchema.nullable().catch(null).parse(line.priceSource),
    source: line.source,
    confidence: ConfidenceSchema.catch("låg").parse(line.confidence),
    confirmed: line.confirmed,
    origin: line.origin === "ai" ? "ai" : "manuell",
  };
}

export function rotSettingsFor(quote: Pick<Quote, "rotEnabled" | "rotPersons">, company: Company) {
  return {
    enabled: quote.rotEnabled,
    percentBp: company.rotPercentBp,
    maxPerPersonOre: company.rotMaxPerPersonOre,
    persons: quote.rotPersons,
  };
}

/** Samma beräkning används för skärm, översikt och PDF. */
export function totalsFor(quote: Quote & { lines: QuoteLine[] }, company: Company): QuoteTotals {
  return calcQuote(quote.lines.map(lineFromDb), company.vatBp, rotSettingsFor(quote, company));
}

export async function updateQuote(db: PrismaClient, id: number, patch: QuotePatch): Promise<Quote> {
  const data = parseOrThrow(QuotePatchSchema, patch);
  assertEditable(await getQuote(db, id));
  const { assumptions, uncertainties, customerQuestions, exclusions, ...rest } = data;
  return db.quote.update({
    where: { id },
    data: {
      ...rest,
      ...(assumptions ? { assumptions: JSON.stringify(cleanList(assumptions)) } : {}),
      ...(uncertainties ? { uncertainties: JSON.stringify(cleanList(uncertainties)) } : {}),
      ...(customerQuestions ? { customerQuestions: JSON.stringify(cleanList(customerQuestions)) } : {}),
      ...(exclusions ? { exclusions: JSON.stringify(cleanList(exclusions)) } : {}),
    },
  });
}

function cleanList(list: string[]): string[] {
  return list.map((s) => s.trim()).filter((s) => s !== "");
}

const LinesSchema = z.array(QuoteLineInputSchema).max(300);

/** Ersätter offertens rader. En granskad offert som ändras går tillbaka till utkast. */
export async function saveLines(db: PrismaClient, id: number, lines: unknown): Promise<QuoteWithRelations> {
  const parsed = parseOrThrow(LinesSchema, lines);
  const quote = await getQuote(db, id);
  assertEditable(quote);

  const articleIds = [...new Set(parsed.map((l) => l.articleId).filter((v): v is number => v !== null))];
  const articles = await db.article.findMany({ where: { id: { in: articleIds } } });
  const byId = new Map(articles.map((a) => [a.id, a]));
  for (const line of parsed) {
    if (line.articleId !== null && !byId.has(line.articleId)) {
      throw new AppError("En rad är kopplad till en artikel som inte längre finns i prislistan.", 400);
    }
  }

  await db.$transaction([
    db.quoteLine.deleteMany({ where: { quoteId: id } }),
    db.quoteLine.createMany({
      data: parsed.map((line, position) => ({
        ...line,
        articleNumber: line.articleId !== null ? byId.get(line.articleId)!.number : null,
        quoteId: id,
        position,
      })),
    }),
    db.quote.update({
      where: { id },
      data: { status: quote.status === "granskad" ? "utkast" : quote.status },
    }),
  ]);
  return getQuote(db, id);
}

function assertEditable(quote: Quote) {
  if (quote.status !== "utkast" && quote.status !== "granskad") {
    throw new AppError(
      `Offerten har status "${quote.status}" och kan inte ändras. Sätt status till utkast först.`,
      409,
    );
  }
}

export async function setStatus(db: PrismaClient, id: number, status: unknown): Promise<Quote> {
  const next = parseOrThrow(QuoteStatusSchema, status) as QuoteStatus;
  const quote = await getQuote(db, id);
  if (next === "granskad") {
    const readiness = checkReadiness(quote.lines.map(lineFromDb), quote.customerName);
    if (!readiness.ready) {
      const count = readiness.lines.length;
      const parts = [...readiness.general];
      if (count > 0) parts.push(`${count} rad(er) har pris som saknas eller olösta markeringar`);
      throw new AppError(`Offerten kan inte markeras som granskad: ${parts.join(", ")}.`, 409);
    }
  }
  return db.quote.update({ where: { id }, data: { status: next } });
}

export async function addAttachment(
  db: PrismaClient,
  quoteId: number,
  input: { kind: "audio" | "photo"; path: string; mimeType: string; originalName: string; size: number },
): Promise<Attachment> {
  await getQuote(db, quoteId);
  return db.attachment.create({ data: { quoteId, ...input, originalName: input.originalName.slice(0, 200) } });
}

/**
 * Transkriberar ljudfiler som ännu inte är transkriberade och lägger till texten
 * i offertens transkribering, som användaren sedan kan rätta.
 */
export async function transcribeQuote(
  db: PrismaClient,
  id: number,
  transcriber: Transcriber,
  readFile: (path: string) => Promise<Uint8Array>,
): Promise<QuoteWithRelations> {
  const quote = await getQuote(db, id);
  const pending = quote.attachments.filter((a) => a.kind === "audio" && a.transcript === null);
  if (pending.length === 0) return quote;

  const texts: string[] = [];
  for (const attachment of pending) {
    const data = await readFile(attachment.path);
    const ext = attachment.path.split(".").pop() ?? "webm";
    const text = await transcriber.transcribe({
      data,
      filename: `inspelning.${ext}`,
      mimeType: attachment.mimeType,
    });
    await db.attachment.update({ where: { id: attachment.id }, data: { transcript: text } });
    if (text) texts.push(text);
  }
  const transcript = [quote.transcript.trim(), ...texts].filter((t) => t !== "").join("\n\n");
  await db.quote.update({ where: { id }, data: { transcript } });
  return getQuote(db, id);
}

export const MAX_PHOTOS_TO_AI = 10;

/** Kör AI-tolkningen och ersätter offertens rader med förslaget. */
export async function interpretQuote(
  db: PrismaClient,
  id: number,
  callModel: CallModel,
  loadPhotoBase64: (path: string) => Promise<string>,
): Promise<QuoteWithRelations> {
  const quote = await getQuote(db, id);
  assertEditable(quote);
  const photos = quote.attachments.filter((a) => a.kind === "photo").slice(0, MAX_PHOTOS_TO_AI);
  if (quote.transcript.trim() === "" && quote.notes.trim() === "" && photos.length === 0) {
    throw new AppError("Det finns inget underlag att tolka. Lägg till röstmemo, foton eller anteckningar.", 400);
  }
  const company = await getCompany(db);
  const articles = await db.article.findMany({ orderBy: { number: "asc" } });

  const images = await Promise.all(
    photos.map(async (p) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data: await loadPhotoBase64(p.path) },
    })),
  );
  const text = buildUserText({
    transcript: quote.transcript,
    notes: quote.notes,
    priceList: articles.map((a) => ({ number: a.number, name: a.name, type: a.type, unit: a.unit })),
    photoCount: images.length,
  });

  const ai = await interpretWithRetry(callModel, [...images, { type: "text", text }]);
  const { lines, warnings } = mapAiLines(ai, articles, company.hourlyRateOre);

  await db.$transaction([
    db.quoteLine.deleteMany({ where: { quoteId: id } }),
    db.quoteLine.createMany({ data: lines.map((line, position) => ({ ...line, quoteId: id, position })) }),
    db.quote.update({
      where: { id },
      data: {
        summary: ai.summary,
        assumptions: JSON.stringify(ai.assumptions),
        uncertainties: JSON.stringify([...ai.uncertainties, ...warnings]),
        customerQuestions: JSON.stringify(ai.customerQuestions),
        exclusions: JSON.stringify(ai.exclusions),
        interpretedAt: new Date(),
        status: "utkast",
      },
    }),
  ]);
  return getQuote(db, id);
}

export function listsFor(quote: Quote) {
  return {
    assumptions: parseStringList(quote.assumptions),
    uncertainties: parseStringList(quote.uncertainties),
    customerQuestions: parseStringList(quote.customerQuestions),
    exclusions: parseStringList(quote.exclusions),
  };
}

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` (${first.path.join(".")})` : "";
    throw new AppError(`Ogiltiga uppgifter${where}: ${first?.message ?? "okänt fel"}`, 400);
  }
  return result.data;
}
