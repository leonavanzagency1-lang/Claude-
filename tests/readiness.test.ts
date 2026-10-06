import { describe, expect, it } from "vitest";
import { checkReadiness, lineIssues, type ReadinessLine } from "@/lib/quote/readiness";

const ok: ReadinessLine = { description: "Trall", unitPriceOre: 2400, articleId: 1, confidence: "hög", confirmed: false };

describe("spärr för att markera offerten som klar", () => {
  it("en komplett rad har inga problem", () => {
    expect(lineIssues(ok)).toEqual([]);
    expect(checkReadiness([ok], "Anna").ready).toBe(true);
  });
  it("rad utan pris blockerar även om den är bekräftad", () => {
    expect(lineIssues({ ...ok, unitPriceOre: null, confirmed: true })).toContain("Pris saknas");
  });
  it("låg säkerhet blockerar tills raden bekräftas", () => {
    expect(lineIssues({ ...ok, confidence: "låg" })).toHaveLength(1);
    expect(lineIssues({ ...ok, confidence: "låg", confirmed: true })).toEqual([]);
  });
  it("rad utan artikel blockerar tills den bekräftas", () => {
    expect(lineIssues({ ...ok, articleId: null })).toHaveLength(1);
    expect(lineIssues({ ...ok, articleId: null, confirmed: true })).toEqual([]);
  });
  it("tom offert och kund utan namn blockerar", () => {
    const r = checkReadiness([], " ");
    expect(r.ready).toBe(false);
    expect(r.general).toHaveLength(2);
  });
  it("rapporterar vilka rader som blockerar", () => {
    const r = checkReadiness([ok, { ...ok, unitPriceOre: null }, ok, { ...ok, confidence: "låg" }], "Anna");
    expect(r.ready).toBe(false);
    expect(r.lines.map((l) => l.index)).toEqual([1, 3]);
  });
});
