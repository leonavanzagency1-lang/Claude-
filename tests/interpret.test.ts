import { describe, expect, it, vi } from "vitest";
import { interpretWithRetry, type CallModel } from "@/lib/ai/interpret";
import { mapAiLines, type PriceListArticle } from "@/lib/ai/mapping";
import { MOCK_INTERPRETATION } from "@/lib/ai/mock";
import { AppError } from "@/lib/errors";

const VALID = JSON.stringify(MOCK_INTERPRETATION);
const turn = (text: string) => ({ text, assistantContent: [{ type: "text", text }] });

describe("AI-tolkning med nytt försök", () => {
  it("returnerar direkt vid giltigt svar", async () => {
    const call = vi.fn<CallModel>().mockResolvedValue(turn(VALID));
    const result = await interpretWithRetry(call, "underlag");
    expect(result.summary).toBe(MOCK_INTERPRETATION.summary);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("försöker en gång till med felmeddelandet vid ogiltigt svar", async () => {
    const call = vi.fn<CallModel>().mockResolvedValueOnce(turn("{inte json")).mockResolvedValueOnce(turn(VALID));
    const result = await interpretWithRetry(call, "underlag");
    expect(result.lines.length).toBe(MOCK_INTERPRETATION.lines.length);
    expect(call).toHaveBeenCalledTimes(2);
    const secondMessages = call.mock.calls[1][0];
    expect(secondMessages).toHaveLength(3);
    expect(secondMessages[1].role).toBe("assistant");
    expect(secondMessages[2].role).toBe("user");
    expect(String(secondMessages[2].content)).toMatch(/inte giltig JSON/);
  });

  it("ger ett tydligt svenskt fel efter två ogiltiga svar, utan krasch", async () => {
    const call = vi.fn<CallModel>().mockResolvedValue(turn('{"summary": ""}'));
    const promise = interpretWithRetry(call, "underlag");
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toThrow(/ogiltigt svar två gånger/);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("släpper igenom nätverksfel från anroparen", async () => {
    const call = vi.fn<CallModel>().mockRejectedValue(new AppError("Kunde inte nå AI-tjänsten.", 503));
    await expect(interpretWithRetry(call, "underlag")).rejects.toThrow("Kunde inte nå AI-tjänsten.");
  });
});

describe("koppling av AI-rader till prislistan", () => {
  const articles: PriceListArticle[] = [
    { id: 1, number: "A-101", type: "arbete", unit: "tim", unitPriceOre: 65_000, markupBp: 0 },
    { id: 2, number: "M-205", type: "material", unit: "m", unitPriceOre: 2_400, markupBp: 1500 },
  ];
  const base = { ...MOCK_INTERPRETATION, lines: [] };

  it("hämtar pris och påslag från prislistan", () => {
    const { lines } = mapAiLines(
      {
        ...base,
        lines: [{ articleNumber: "m-205", description: "Trall", quantity: 210, unit: "m", type: "material", source: "trall", confidence: "hög" }],
      },
      articles,
      null,
    );
    expect(lines[0]).toMatchObject({
      articleId: 2,
      articleNumber: "M-205",
      unitPriceOre: 2_400,
      markupBp: 1500,
      priceSource: "prislista",
      quantityMilli: 210_000,
      confirmed: false,
      origin: "ai",
    });
  });

  it("okänt artikelnummer ger rad utan pris och låg säkerhet", () => {
    const { lines, warnings } = mapAiLines(
      {
        ...base,
        lines: [{ articleNumber: "X-999", description: "Något", quantity: 1, unit: "st", type: "material", source: "x", confidence: "hög" }],
      },
      articles,
      65_000,
    );
    expect(lines[0]).toMatchObject({ articleId: null, articleNumber: null, unitPriceOre: null, confidence: "låg" });
    expect(warnings[0]).toContain("X-999");
  });

  it("mängd null blir 0 med låg säkerhet", () => {
    const { lines } = mapAiLines(
      {
        ...base,
        lines: [{ articleNumber: "M-205", description: "Trall", quantity: null, unit: "m", type: "material", source: "x", confidence: "hög" }],
      },
      articles,
      null,
    );
    expect(lines[0].quantityMilli).toBe(0);
    expect(lines[0].confidence).toBe("låg");
  });

  it("arbetstimmar utan artikel får firmans timpris (inte ett AI-pris)", () => {
    const { lines } = mapAiLines(
      {
        ...base,
        lines: [{ articleNumber: null, description: "Extra arbete", quantity: 4, unit: "tim", type: "arbete", source: "x", confidence: "medel" }],
      },
      articles,
      70_000,
    );
    expect(lines[0]).toMatchObject({ unitPriceOre: 70_000, priceSource: "timpris", articleId: null });
  });

  it("enhet som inte stämmer med artikeln ersätts och markeras", () => {
    const { lines, warnings } = mapAiLines(
      {
        ...base,
        lines: [{ articleNumber: "M-205", description: "Trall", quantity: 24, unit: "m²", type: "material", source: "x", confidence: "hög" }],
      },
      articles,
      null,
    );
    expect(lines[0].unit).toBe("m");
    expect(lines[0].confidence).toBe("låg");
    expect(warnings).toHaveLength(1);
  });

  it("inget pris i resultatet kommer från AI:n", () => {
    const tampered = {
      ...base,
      lines: [{ articleNumber: null, description: "Fönster", quantity: 1, unit: "st" as const, type: "material" as const, source: "x", confidence: "hög" as const, unitPrice: 5 }],
    };
    const { lines } = mapAiLines(tampered, articles, 65_000);
    expect(lines[0].unitPriceOre).toBeNull();
    expect(lines[0].priceSource).toBeNull();
  });
});
