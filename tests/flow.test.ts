import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockCaller } from "@/lib/ai/mock";
import { MockTranscriber } from "@/lib/transcription/mock";
import { MOCK_TRANSCRIPT } from "@/lib/ai/mock";
import {
  addAttachment,
  createQuote,
  getQuote,
  interpretQuote,
  lineFromDb,
  saveLines,
  setStatus,
  totalsFor,
  transcribeQuote,
  updateQuote,
} from "@/lib/services/quotes";
import { getCompany } from "@/lib/services/company";
import { buildPdfModel } from "@/lib/pdf/model";
import { checkReadiness } from "@/lib/quote/readiness";

const db = new PrismaClient({ datasourceUrl: "file:./test.db" });

beforeAll(async () => {
  await db.company.create({ data: { id: 1, name: "Testbygg AB", hourlyRateOre: 65_000, introText: "Hej!" } });
  const articles = [
    ["A-101", "Snickeriarbete", "arbete", "tim", 65_000, 0],
    ["A-103", "Rivning av befintlig altan", "arbete", "m²", 18_000, 0],
    ["A-105", "Bortforsling", "övrigt", "paket", 450_000, 0],
    ["M-201", "Plintfundament", "material", "st", 29_500, 1500],
    ["M-203", "Regel 45×195", "material", "m", 8_900, 1500],
    ["M-205", "Trall 28×120", "material", "m", 2_400, 1500],
    ["M-209", "Räcke", "material", "m", 69_000, 1500],
    ["M-210", "Trappa", "material", "st", 320_000, 1500],
  ] as const;
  for (const [number, name, type, unit, unitPriceOre, markupBp] of articles) {
    await db.article.create({ data: { number, name, type, unit, unitPriceOre, markupBp } });
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe("hela flödet i mock-läge", () => {
  it("platsbesök → transkribering → AI-utkast → granskning → klar", async () => {
    const quote = await createQuote(db, { customerName: "Anna Andersson", customerEmail: "anna@example.com" }, new Date("2026-03-01"));
    expect(quote.number).toBe("2026-0001");
    expect(quote.introText).toBe("Hej!");
    const second = await createQuote(db, { customerName: "Bo" }, new Date("2026-03-02"));
    expect(second.number).toBe("2026-0002");

    // Underlag: en ljudfil (innehållet spelar ingen roll i mock-läget)
    await addAttachment(db, quote.id, { kind: "audio", path: "x/inspelning.webm", mimeType: "audio/webm", originalName: "memo.webm", size: 10 });
    const transcribed = await transcribeQuote(db, quote.id, new MockTranscriber(), async () => new Uint8Array([1, 2, 3]));
    expect(transcribed.transcript).toBe(MOCK_TRANSCRIPT);
    expect(transcribed.attachments[0].transcript).toBe(MOCK_TRANSCRIPT);

    // Användaren rättar transkriberingen
    await updateQuote(db, quote.id, { transcript: MOCK_TRANSCRIPT + " Rättad." });

    const interpreted = await interpretQuote(db, quote.id, createMockCaller(), async () => "");
    expect(interpreted.lines.length).toBe(9);
    expect(interpreted.summary).toMatch(/altan/);

    // Alla priser kommer från prislistan eller timpriset – aldrig från AI:n.
    const articles = await db.article.findMany();
    for (const line of interpreted.lines) {
      if (line.articleId !== null) {
        expect(line.unitPriceOre).toBe(articles.find((a) => a.id === line.articleId)!.unitPriceOre);
        expect(line.priceSource).toBe("prislista");
      } else {
        expect(line.unitPriceOre).toBeNull();
      }
    }

    // Utkastet kan inte markeras som klart: rader med låg säkerhet / utan pris
    await expect(setStatus(db, quote.id, "granskad")).rejects.toThrow(/kan inte markeras som granskad/);

    // Användaren åtgärdar: tar bort raden utan pris, sätter mängd och bekräftar resten
    const lines = interpreted.lines
      .map(lineFromDb)
      .filter((l) => l.unitPriceOre !== null)
      .map((l) => ({ ...l, quantityMilli: l.quantityMilli === 0 ? 40_000 : l.quantityMilli, confirmed: true }));
    const saved = await saveLines(db, quote.id, lines);
    expect(checkReadiness(saved.lines.map(lineFromDb), saved.customerName).ready).toBe(true);

    const ready = await setStatus(db, quote.id, "granskad");
    expect(ready.status).toBe("granskad");

    // Summor i PDF-modellen är exakt desamma som på skärmen
    const full = await getQuote(db, quote.id);
    const company = await getCompany(db);
    const screenTotals = totalsFor(full, company);
    const pdf = buildPdfModel(full, company, new Date("2026-03-03"));
    expect(pdf.totals).toEqual(screenTotals);
    expect(pdf.number).toBe("2026-0001");
    expect(pdf.validUntil).toBe("2026-04-02");
    expect(pdf.rows).toHaveLength(8);

    // Ändring av rader i en granskad offert gör den till utkast igen
    const edited = await saveLines(db, quote.id, lines.slice(1));
    expect(edited.status).toBe("utkast");

    // Skickade offerter kan inte ändras
    await setStatus(db, quote.id, "skickad");
    await expect(saveLines(db, quote.id, lines)).rejects.toThrow(/kan inte ändras/);
    await expect(updateQuote(db, quote.id, { summary: "ändrad" })).rejects.toThrow(/kan inte ändras/);
    // Tillbaka till utkast gör den redigerbar igen
    await setStatus(db, quote.id, "utkast");
    await expect(updateQuote(db, quote.id, { summary: "ändrad" })).resolves.toMatchObject({ summary: "ändrad" });
  });

  it("kräver underlag innan AI-tolkning", async () => {
    const q = await createQuote(db, { customerName: "Tom" });
    await expect(interpretQuote(db, q.id, createMockCaller(), async () => "")).rejects.toThrow(/inget underlag/);
  });

  it("validerar indata med svenska meddelanden", async () => {
    await expect(createQuote(db, { customerName: "  " })).rejects.toThrow(/Kundens namn/);
    await expect(createQuote(db, { customerName: "X", customerEmail: "inte-en-adress" })).rejects.toThrow(/e-post/);
    const q = await createQuote(db, { customerName: "Y" });
    await expect(saveLines(db, q.id, [{ description: "x" }])).rejects.toThrow(/Ogiltiga uppgifter/);
    await expect(setStatus(db, q.id, "påhittad")).rejects.toThrow(/Ogiltiga uppgifter/);
  });
});
