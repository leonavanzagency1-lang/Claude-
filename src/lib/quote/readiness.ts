import type { Confidence } from "@/lib/domain";

export interface ReadinessLine {
  description: string;
  unitPriceOre: number | null;
  articleId: number | null;
  confidence: Confidence;
  confirmed: boolean;
}

export interface LineIssue {
  index: number;
  reasons: string[];
}

export interface Readiness {
  ready: boolean;
  /** Övergripande problem som inte hör till en enskild rad. */
  general: string[];
  lines: LineIssue[];
}

/** Problem på en enskild rad som hindrar att offerten markeras som granskad. */
export function lineIssues(line: ReadinessLine): string[] {
  const reasons: string[] = [];
  if (line.description.trim() === "") reasons.push("Beskrivning saknas");
  if (line.unitPriceOre === null) reasons.push("Pris saknas");
  if (!line.confirmed) {
    if (line.confidence === "låg") reasons.push("Låg säkerhet – bekräfta raden");
    if (line.articleId === null) reasons.push("Ingen artikel kopplad – bekräfta raden");
  }
  return reasons;
}

/** Visar om raden ska markeras visuellt (även om den redan är bekräftad). */
export function lineNeedsAttention(line: ReadinessLine): boolean {
  return lineIssues(line).length > 0;
}

export function checkReadiness(lines: ReadinessLine[], customerName: string): Readiness {
  const general: string[] = [];
  if (lines.length === 0) general.push("Offerten har inga rader");
  if (customerName.trim() === "") general.push("Kundens namn saknas");
  const issues = lines
    .map((line, index) => ({ index, reasons: lineIssues(line) }))
    .filter((i) => i.reasons.length > 0);
  return { ready: general.length === 0 && issues.length === 0, general, lines: issues };
}
