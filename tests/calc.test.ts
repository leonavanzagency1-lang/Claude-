import { describe, expect, it } from "vitest";
import { calcLine, calcQuote, type CalcLine, type RotSettings } from "@/lib/calc/quote";
import { formatMilli, formatOre, mulDivRound, parseKronor, parseQuantity } from "@/lib/calc/money";

const line = (over: Partial<CalcLine>): CalcLine => ({
  type: "material",
  quantityMilli: 1000,
  unitPriceOre: 10_000,
  markupBp: 0,
  ...over,
});

const rot = (over: Partial<RotSettings> = {}): RotSettings => ({
  enabled: true,
  percentBp: 3000,
  maxPerPersonOre: 5_000_000,
  persons: 1,
  ...over,
});

describe("mulDivRound", () => {
  it("avrundar halva uppåt", () => {
    expect(mulDivRound(5, 1, 10)).toBe(1); // 0,5 -> 1
    expect(mulDivRound(4, 1, 10)).toBe(0); // 0,4 -> 0
    expect(mulDivRound(15, 1, 10)).toBe(2); // 1,5 -> 2
    expect(mulDivRound(-5, 1, 10)).toBe(-1);
  });
  it("hanterar stora tal utan flyttalsfel", () => {
    // produkten ligger över 2^53 i mellanledet
    expect(mulDivRound(99_999_999_999, 99_999, 1000)).toBe(9_999_899_999_900);
    expect(mulDivRound(1_000_000_000, 1_000_000, 1000)).toBe(1_000_000_000_000);
  });
  it("kastar för icke-heltal", () => {
    expect(() => mulDivRound(1.5, 1, 1)).toThrow();
  });
});

describe("radberäkning", () => {
  it("räknar mängd × à-pris", () => {
    expect(calcLine(line({ quantityMilli: 2500, unitPriceOre: 12_345 }))).toEqual({
      netOre: 30_863, // 2,5 × 123,45 = 308,625 -> 308,63
      markupOre: 0,
      totalExVatOre: 30_863,
    });
  });
  it("räknar påslag på nettobeloppet", () => {
    const r = calcLine(line({ quantityMilli: 3000, unitPriceOre: 9_900, markupBp: 1500 }));
    expect(r.netOre).toBe(29_700);
    expect(r.markupOre).toBe(4_455); // 15 % av 297 kr
    expect(r.totalExVatOre).toBe(34_155);
  });
  it("avrundar påslag till hela ören", () => {
    // 0,333 × 1 kr = 0,333 kr -> 33 öre; 12,5 % av 33 öre = 4,125 -> 4 öre
    const r = calcLine(line({ quantityMilli: 333, unitPriceOre: 100, markupBp: 1250 }));
    expect(r.netOre).toBe(33);
    expect(r.markupOre).toBe(4);
  });
  it("rad med mängd 0 ger 0 kr", () => {
    expect(calcLine(line({ quantityMilli: 0, unitPriceOre: 50_000, markupBp: 2000 }))).toEqual({
      netOre: 0,
      markupOre: 0,
      totalExVatOre: 0,
    });
  });
  it("rad utan pris räknas som 0", () => {
    expect(calcLine(line({ unitPriceOre: null })).totalExVatOre).toBe(0);
  });
});

describe("offertsummor", () => {
  it("tom offert ger nollor", () => {
    const t = calcQuote([], 2500, rot());
    expect(t).toMatchObject({
      laborOre: 0,
      materialOre: 0,
      otherOre: 0,
      markupOre: 0,
      totalExVatOre: 0,
      vatOre: 0,
      totalInclVatOre: 0,
      toPayOre: 0,
    });
    expect(t.rot?.deductionOre).toBe(0);
    expect(t.lines).toEqual([]);
  });

  it("summerar per typ, påslag och moms 25 %", () => {
    const t = calcQuote(
      [
        line({ type: "arbete", quantityMilli: 10_000, unitPriceOre: 65_000 }), // 6 500 kr
        line({ type: "material", quantityMilli: 12_000, unitPriceOre: 29_500, markupBp: 1500 }), // 3 540 + 531
        line({ type: "övrigt", quantityMilli: 1000, unitPriceOre: 450_000 }), // 4 500
      ],
      2500,
    );
    expect(t.laborOre).toBe(650_000);
    expect(t.materialOre).toBe(354_000);
    expect(t.otherOre).toBe(450_000);
    expect(t.markupOre).toBe(53_100);
    expect(t.totalExVatOre).toBe(1_507_100);
    expect(t.vatOre).toBe(376_775);
    expect(t.totalInclVatOre).toBe(1_883_875);
    expect(t.rot).toBeNull();
    expect(t.toPayOre).toBe(1_883_875);
  });

  it("momsen avrundas till hela ören", () => {
    // 0,01 kr + 0,02 kr = 3 öre; 25 % = 0,75 -> 1 öre
    const t = calcQuote([line({ unitPriceOre: 1 }), line({ unitPriceOre: 2 })], 2500);
    expect(t.totalExVatOre).toBe(3);
    expect(t.vatOre).toBe(1);
    expect(t.totalInclVatOre).toBe(4);
  });

  it("räknar med annan momssats", () => {
    const t = calcQuote([line({ unitPriceOre: 10_000 })], 1200);
    expect(t.vatOre).toBe(1_200);
  });

  it("summan är summan av radernas avrundade belopp", () => {
    const lines = [
      line({ quantityMilli: 333, unitPriceOre: 100 }),
      line({ quantityMilli: 333, unitPriceOre: 100 }),
      line({ quantityMilli: 333, unitPriceOre: 100 }),
    ];
    const t = calcQuote(lines, 2500);
    expect(t.lines.map((l) => l.netOre)).toEqual([33, 33, 33]);
    expect(t.totalExVatOre).toBe(99);
  });

  it("mängd 0 påverkar inte summorna", () => {
    const with0 = calcQuote([line({}), line({ quantityMilli: 0, unitPriceOre: 99_999 })], 2500);
    const without = calcQuote([line({})], 2500);
    expect(with0.totalInclVatOre).toBe(without.totalInclVatOre);
  });
});

describe("ROT", () => {
  const labor = line({ type: "arbete", quantityMilli: 10_000, unitPriceOre: 50_000 }); // 5 000 kr exkl. moms
  const material = line({ type: "material", quantityMilli: 1000, unitPriceOre: 200_000 }); // 2 000 kr

  it("beräknar avdrag på arbetskostnad inkl. moms, utan att taket nås", () => {
    const t = calcQuote([labor, material], 2500, rot({ percentBp: 3000, maxPerPersonOre: 5_000_000 }));
    expect(t.rot).toEqual({
      laborInclVatOre: 625_000,
      uncappedOre: 187_500,
      capOre: 5_000_000,
      deductionOre: 187_500,
      capped: false,
    });
    expect(t.totalInclVatOre).toBe(875_000);
    expect(t.toPayOre).toBe(875_000 - 187_500);
  });

  it("begränsas av maxbelopp per person", () => {
    const t = calcQuote([labor], 2500, rot({ percentBp: 3000, maxPerPersonOre: 100_000 }));
    expect(t.rot?.uncappedOre).toBe(187_500);
    expect(t.rot?.deductionOre).toBe(100_000);
    expect(t.rot?.capped).toBe(true);
    expect(t.toPayOre).toBe(625_000 - 100_000);
  });

  it("taket multipliceras med antal personer", () => {
    const t = calcQuote([labor], 2500, rot({ percentBp: 3000, maxPerPersonOre: 100_000, persons: 2 }));
    expect(t.rot?.capOre).toBe(200_000);
    expect(t.rot?.deductionOre).toBe(187_500);
    expect(t.rot?.capped).toBe(false);
  });

  it("påslag på arbetsrader räknas in i arbetskostnaden", () => {
    const t = calcQuote([line({ type: "arbete", unitPriceOre: 100_000, markupBp: 1000 })], 2500, rot());
    // (1 000 + 100) × 1,25 = 1 375 kr; 30 % = 412,50 kr
    expect(t.rot?.laborInclVatOre).toBe(137_500);
    expect(t.rot?.deductionOre).toBe(41_250);
  });

  it("ingen ROT om den är avstängd", () => {
    expect(calcQuote([labor], 2500, rot({ enabled: false })).rot).toBeNull();
  });

  it("ingen ROT om procentsats eller maxbelopp inte är ifyllt", () => {
    expect(calcQuote([labor], 2500, rot({ percentBp: null })).rot).toBeNull();
    expect(calcQuote([labor], 2500, rot({ maxPerPersonOre: null })).rot).toBeNull();
  });

  it("material ger inget ROT-avdrag", () => {
    expect(calcQuote([material], 2500, rot()).rot?.deductionOre).toBe(0);
  });
});

describe("formatering och tolkning", () => {
  it("formaterar belopp på svenska", () => {
    expect(formatOre(123_456)).toBe("1 234,56 kr");
    expect(formatOre(5)).toBe("0,05 kr");
    expect(formatOre(-100, false)).toBe("−1,00");
  });
  it("formaterar mängder", () => {
    expect(formatMilli(1500)).toBe("1,5");
    expect(formatMilli(12_000)).toBe("12");
    expect(formatMilli(333)).toBe("0,333");
  });
  it("tolkar belopp och mängder", () => {
    expect(parseKronor("1 234,50")).toBe(123_450);
    expect(parseKronor("1234.5")).toBe(123_450);
    expect(parseKronor("12,345")).toBe(1_235);
    expect(parseKronor("abc")).toBeNull();
    expect(parseKronor("")).toBeNull();
    expect(parseQuantity("2,5")).toBe(2500);
    expect(parseQuantity("0")).toBe(0);
  });
});
