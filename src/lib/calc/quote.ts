import type { LineType } from "@/lib/domain";
import { mulDivRound } from "./money";

/**
 * Deterministisk offertberäkning. All matematik sker här – aldrig i AI:n.
 * Alla belopp i ören, procentsatser i baspunkter, mängder i tusendelar.
 */

export interface CalcLine {
  type: LineType;
  quantityMilli: number;
  /** null = saknar pris; räknas som 0 men blockerar att offerten markeras som klar. */
  unitPriceOre: number | null;
  markupBp: number;
}

export interface RotSettings {
  enabled: boolean;
  /** Procentsats i baspunkter, null om inte ifylld i firmainställningarna. */
  percentBp: number | null;
  /** Maxbelopp per person och år i ören, null om inte ifyllt. */
  maxPerPersonOre: number | null;
  persons: number;
}

export interface LineAmounts {
  /** mängd × à-pris, utan påslag */
  netOre: number;
  markupOre: number;
  /** netto + påslag, exkl. moms */
  totalExVatOre: number;
}

export interface QuoteTotals {
  laborOre: number;
  materialOre: number;
  otherOre: number;
  markupOre: number;
  totalExVatOre: number;
  vatOre: number;
  totalInclVatOre: number;
  rot: RotResult | null;
  /** Belopp att betala: efter preliminärt ROT-avdrag om det gäller, annars summa inkl. moms. */
  toPayOre: number;
  lines: LineAmounts[];
}

export interface RotResult {
  /** Arbetskostnad inkl. påslag och moms som avdraget beräknas på. */
  laborInclVatOre: number;
  /** Avdrag före tak. */
  uncappedOre: number;
  capOre: number;
  deductionOre: number;
  capped: boolean;
}

export const ROT_DISCLAIMER = "Preliminärt ROT-avdrag, förutsätter att kunden har utrymme kvar";

export function calcLine(line: CalcLine): LineAmounts {
  const price = line.unitPriceOre ?? 0;
  const netOre = mulDivRound(line.quantityMilli, price, 1000);
  const markupOre = mulDivRound(netOre, line.markupBp, 10_000);
  return { netOre, markupOre, totalExVatOre: netOre + markupOre };
}

export function isRotApplicable(rot: RotSettings | null | undefined): rot is RotSettings & {
  percentBp: number;
  maxPerPersonOre: number;
} {
  return (
    !!rot &&
    rot.enabled &&
    rot.percentBp !== null &&
    rot.maxPerPersonOre !== null &&
    rot.percentBp > 0 &&
    rot.persons >= 1
  );
}

export function calcQuote(lines: CalcLine[], vatBp: number, rot?: RotSettings | null): QuoteTotals {
  let laborOre = 0;
  let materialOre = 0;
  let otherOre = 0;
  let markupOre = 0;
  let laborWithMarkupOre = 0;

  const amounts = lines.map((line) => {
    const a = calcLine(line);
    markupOre += a.markupOre;
    if (line.type === "arbete") {
      laborOre += a.netOre;
      laborWithMarkupOre += a.totalExVatOre;
    } else if (line.type === "material") {
      materialOre += a.netOre;
    } else {
      otherOre += a.netOre;
    }
    return a;
  });

  const totalExVatOre = laborOre + materialOre + otherOre + markupOre;
  const vatOre = mulDivRound(totalExVatOre, vatBp, 10_000);
  const totalInclVatOre = totalExVatOre + vatOre;

  let rotResult: RotResult | null = null;
  if (isRotApplicable(rot)) {
    const laborVat = mulDivRound(laborWithMarkupOre, vatBp, 10_000);
    const laborInclVatOre = laborWithMarkupOre + laborVat;
    const uncappedOre = mulDivRound(laborInclVatOre, rot.percentBp, 10_000);
    const capOre = rot.maxPerPersonOre * rot.persons;
    const deductionOre = Math.min(uncappedOre, capOre);
    rotResult = { laborInclVatOre, uncappedOre, capOre, deductionOre, capped: uncappedOre > capOre };
  }

  return {
    laborOre,
    materialOre,
    otherOre,
    markupOre,
    totalExVatOre,
    vatOre,
    totalInclVatOre,
    rot: rotResult,
    toPayOre: totalInclVatOre - (rotResult?.deductionOre ?? 0),
    lines: amounts,
  };
}
