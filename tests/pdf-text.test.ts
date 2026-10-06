import { describe, expect, it } from "vitest";
import { pdfSafe, pdfSafeDeep } from "@/lib/pdf/text";

describe("text i PDF", () => {
  it("behåller svenska tecken och vanliga symboler", () => {
    expect(pdfSafe("Åäö ÅÄÖ é × m² m³ – ”citat” 1 234,00 kr €")).toBe("Åäö ÅÄÖ é × m² m³ – ”citat” 1 234,00 kr €");
  });
  it("ersätter tecken som typsnittet saknar", () => {
    expect(pdfSafe("≈ 200 m")).toBe("ca  200 m");
    expect(pdfSafe("−1 000,00 kr")).toBe("-1 000,00 kr");
    expect(pdfSafe("🙂")).toBe("?");
  });
  it("tillämpas rekursivt men lämnar tal orörda", () => {
    expect(pdfSafeDeep({ a: ["≈"], b: 5, c: { d: "−" }, e: null })).toEqual({ a: ["ca "], b: 5, c: { d: "-" }, e: null });
  });
});
