/**
 * Seed-data: en exempelfirma, en prislista med exempelpriser för altaner och
 * tillbyggnader samt ett exempelplatsbesök. Kan köras flera gånger.
 */
import { PrismaClient } from "@prisma/client";
import { createQuote } from "../src/lib/services/quotes";

const db = new PrismaClient();

const kr = (value: number) => Math.round(value * 100);
const pct = (value: number) => Math.round(value * 100);

const ARTICLES = [
  { number: "A-101", name: "Snickeriarbete", type: "arbete", unit: "tim", price: 650, markup: 0 },
  { number: "A-102", name: "Hantlangare / grovarbete", type: "arbete", unit: "tim", price: 520, markup: 0 },
  { number: "A-103", name: "Rivning av befintlig altan", type: "arbete", unit: "m²", price: 180, markup: 0 },
  { number: "A-104", name: "Etablering och avetablering", type: "arbete", unit: "paket", price: 2500, markup: 0 },
  { number: "A-105", name: "Bortforsling av rivningsmaterial inkl. container", type: "övrigt", unit: "paket", price: 4500, markup: 0 },
  { number: "A-106", name: "Markarbete och avjämning", type: "arbete", unit: "m²", price: 220, markup: 0 },
  { number: "M-201", name: "Plintfundament betong inkl. plintbeslag", type: "material", unit: "st", price: 295, markup: 15 },
  { number: "M-202", name: "Markskruv 76×1000 mm", type: "material", unit: "st", price: 420, markup: 15 },
  { number: "M-203", name: "Regel tryckimpregnerad 45×195", type: "material", unit: "m", price: 89, markup: 15 },
  { number: "M-204", name: "Regel tryckimpregnerad 45×145", type: "material", unit: "m", price: 62, markup: 15 },
  { number: "M-205", name: "Trall tryckimpregnerad 28×120", type: "material", unit: "m", price: 24, markup: 15 },
  { number: "M-206", name: "Trall komposit 25×140", type: "material", unit: "m", price: 95, markup: 15 },
  { number: "M-207", name: "Balkskor, vinkelbeslag och spik", type: "material", unit: "paket", price: 850, markup: 10 },
  { number: "M-208", name: "Trallskruv rostfri (500 st)", type: "material", unit: "paket", price: 595, markup: 10 },
  { number: "M-209", name: "Räcke trä, komplett", type: "material", unit: "m", price: 690, markup: 15 },
  { number: "M-210", name: "Trappa trä 3 steg", type: "material", unit: "st", price: 3200, markup: 15 },
  { number: "M-211", name: "Markduk", type: "material", unit: "m²", price: 18, markup: 10 },
  { number: "M-212", name: "Makadam 8–16 mm", type: "material", unit: "m³", price: 650, markup: 10 },
  { number: "M-213", name: "Takstol tillbyggnad", type: "material", unit: "st", price: 1450, markup: 15 },
  { number: "M-214", name: "Mineralullsisolering 195 mm", type: "material", unit: "m²", price: 145, markup: 10 },
  { number: "M-215", name: "Fönster 10×12 treglas", type: "material", unit: "st", price: 4900, markup: 10 },
  { number: "O-301", name: "Ritning och bygglovshandlingar", type: "övrigt", unit: "paket", price: 6500, markup: 0 },
  { number: "O-302", name: "Hyra av byggställning", type: "övrigt", unit: "paket", price: 3500, markup: 0 },
] as const;

async function main() {
  await db.company.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Exempelbygg AB",
      orgNumber: "559999-0000",
      address: "Byggvägen 1\n123 45 Exempelstad",
      phone: "070-000 00 00",
      email: "info@exempelbygg.se",
      fSkatt: true,
      paymentTerms: "30 dagar netto",
      validityDays: 30,
      introText: "Tack för ett trevligt platsbesök! Här kommer vår offert enligt överenskommelse.",
      termsText:
        "Arbetet utförs enligt ABS 18. Ändrings- och tilläggsarbeten debiteras enligt gällande timpris och prislista. Priser gäller under förutsättning att inga dolda fel upptäcks.",
      closingText: "Vi ser fram emot att hjälpa er. Hör av er om ni har frågor!",
      hourlyRateOre: kr(650),
      vatBp: 2500,
      // ROT lämnas medvetet tomt – kontrollera aktuella regler hos Skatteverket.
      rotPercentBp: null,
      rotMaxPerPersonOre: null,
    },
  });

  for (const a of ARTICLES) {
    const data = {
      name: a.name,
      type: a.type,
      unit: a.unit,
      unitPriceOre: kr(a.price),
      markupBp: pct(a.markup),
      isExamplePrice: true,
    };
    await db.article.upsert({ where: { number: a.number }, update: data, create: { number: a.number, ...data } });
  }

  if ((await db.quote.count()) === 0) {
    const quote = await createQuote(db, {
      customerName: "Anna Andersson",
      customerAddress: "Exempelgatan 12\n123 45 Exempelstad",
      customerPhone: "070-123 45 67",
      customerEmail: "anna.andersson@example.com",
      propertyDesignation: "Exempelstad Björken 1:23",
    });
    await db.quote.update({
      where: { id: quote.id },
      data: {
        notes:
          "Ny altan ca 4×6 m på baksidan. Gammal altan ca 15 m² rivs. Tryckimpregnerad trall, plintgrund (12 plintar), räcke 6 m, en trappa. Belysning ingår ej.",
      },
    });
  }

  console.log(`Seed klar: exempelfirma, ${ARTICLES.length} artiklar (exempelpriser) och exempelplatsbesök.`);
}

main()
  .catch((error) => {
    console.error("Seed misslyckades:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
