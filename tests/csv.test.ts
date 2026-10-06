import { describe, expect, it } from "vitest";
import { articlesToCsv, parseArticlesCsv, parseCsv, type CsvArticle } from "@/lib/csv/articles";

const articles: CsvArticle[] = [
  { number: "A-101", name: "Snickeriarbete", type: "arbete", unit: "tim", unitPriceOre: 65_000, markupBp: 0, isExamplePrice: true },
  { number: "M-205", name: 'Trall 28×120; "tryckimp"', type: "material", unit: "m²", unitPriceOre: 2_450, markupBp: 1250, isExamplePrice: false },
];

describe("CSV för prislistan", () => {
  it("export följt av import ger samma artiklar", () => {
    const { articles: back, errors } = parseArticlesCsv(articlesToCsv(articles));
    expect(errors).toEqual([]);
    expect(back).toEqual(articles);
  });

  it("hanterar citattecken och radbrytningar i fält", () => {
    expect(parseCsv('a;"b;c";"d""e"\r\n"rad\nbryt";x\n', ";")).toEqual([
      ["a", "b;c", 'd"e'],
      ["rad\nbryt", "x"],
    ]);
  });

  it("accepterar kommaseparerad fil och vanliga alias för enheter", () => {
    const csv = "artikelnummer,namn,typ,enhet,a_pris_exkl_moms\nX-1,Makadam,material,m3,650.50\nX-2,Markduk,material,kvm,18";
    const { articles: parsed, errors } = parseArticlesCsv(csv);
    expect(errors).toEqual([]);
    expect(parsed.map((a) => [a.unit, a.unitPriceOre, a.markupBp])).toEqual([
      ["m³", 65_050, 0],
      ["m²", 1_800, 0],
    ]);
  });

  it("rapporterar fel per rad", () => {
    const csv = [
      "artikelnummer;namn;typ;enhet;a_pris_exkl_moms;paslag_procent",
      "A-1;Arbete;arbete;tim;650;0",
      ";Utan nummer;material;st;10;0",
      "A-3;Fel typ;verktyg;st;10;0",
      "A-4;Fel pris;material;st;tio;0",
      "A-1;Dubblett;arbete;tim;650;0",
    ].join("\n");
    const { articles: parsed, errors } = parseArticlesCsv(csv);
    expect(parsed).toHaveLength(1);
    expect(errors).toHaveLength(4);
    expect(errors[0]).toMatch(/^Rad 3:/);
    expect(errors[3]).toMatch(/flera gånger/);
  });

  it("kräver rätt rubrikrad", () => {
    expect(parseArticlesCsv("nummer;namn\n1;x").errors[0]).toMatch(/saknar kolumnerna/);
    expect(parseArticlesCsv("").errors[0]).toMatch(/tom/);
  });
});
