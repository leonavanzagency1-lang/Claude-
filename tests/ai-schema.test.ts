import { describe, expect, it } from "vitest";
import { parseAiResponse } from "@/lib/ai/schema";
import { MOCK_INTERPRETATION } from "@/lib/ai/mock";

const valid = () => structuredClone(MOCK_INTERPRETATION);

describe("validering av AI-svar", () => {
  it("godkänner exempelsvaret", () => {
    const r = parseAiResponse(JSON.stringify(valid()));
    expect(r.success).toBe(true);
  });

  it("godkänner JSON inslagen i kodblock", () => {
    const r = parseAiResponse("```json\n" + JSON.stringify(valid()) + "\n```");
    expect(r.success).toBe(true);
  });

  it("underkänner text som inte är JSON", () => {
    const r = parseAiResponse("Här är offerten: ...");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/inte giltig JSON/);
  });

  it("underkänner avklippt JSON", () => {
    const text = JSON.stringify(valid());
    expect(parseAiResponse(text.slice(0, text.length / 2)).success).toBe(false);
  });

  it("underkänner svar där obligatoriska fält saknas", () => {
    const { summary: _summary, ...rest } = valid();
    const r = parseAiResponse(JSON.stringify(rest));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain("summary");
  });

  it("underkänner rader med ogiltig enhet, typ eller säkerhet", () => {
    for (const patch of [{ unit: "kvm" }, { type: "arbetstid" }, { confidence: "säker" }]) {
      const v = valid();
      Object.assign(v.lines[0], patch);
      const r = parseAiResponse(JSON.stringify(v));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error).toContain("lines.0");
    }
  });

  it("underkänner negativ mängd och mängd som text", () => {
    const v1 = valid();
    v1.lines[0].quantity = -3;
    expect(parseAiResponse(JSON.stringify(v1)).success).toBe(false);
    const v2 = valid() as unknown as { lines: Record<string, unknown>[] };
    v2.lines[0].quantity = "15";
    expect(parseAiResponse(JSON.stringify(v2)).success).toBe(false);
  });

  it("underkänner tom beskrivning", () => {
    const v = valid();
    v.lines[0].description = "";
    expect(parseAiResponse(JSON.stringify(v)).success).toBe(false);
  });

  it("underkänner ofullständig rad", () => {
    const v = valid() as unknown as { lines: Record<string, unknown>[] };
    delete v.lines[2].source;
    delete v.lines[2].confidence;
    const r = parseAiResponse(JSON.stringify(v));
    expect(r.success).toBe(false);
  });

  it("underkänner fel typ på listor", () => {
    const v = valid() as unknown as Record<string, unknown>;
    v.assumptions = "ett antagande";
    expect(parseAiResponse(JSON.stringify(v)).success).toBe(false);
  });

  it("tar bort pris som AI:n försöker smyga in", () => {
    const v = valid() as unknown as { lines: Record<string, unknown>[]; totalPrice?: number };
    v.lines[0].unitPrice = 999;
    v.lines[0].price = 12345;
    v.totalPrice = 100000;
    const r = parseAiResponse(JSON.stringify(v));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lines[0]).not.toHaveProperty("unitPrice");
      expect(r.data.lines[0]).not.toHaveProperty("price");
      expect(r.data).not.toHaveProperty("totalPrice");
    }
  });

  it("godkänner null som mängd och artikelnummer", () => {
    const v = valid();
    v.lines[0].quantity = null;
    v.lines[0].articleNumber = null;
    expect(parseAiResponse(JSON.stringify(v)).success).toBe(true);
  });
});
